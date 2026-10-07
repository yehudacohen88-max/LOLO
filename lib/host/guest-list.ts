import "server-only";
import { cookies } from "next/headers";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { parseGuestInput, type EventGuest } from "@/lib/host/guest-fields";
import {
  HOST_SESSION_COOKIE,
  readHostSessionToken,
} from "@/lib/host/session";
import {
  createInviteCredentials,
  decryptInviteToken,
  hashInviteToken,
  inviteTokenPath,
} from "@/lib/invite/token";

export type { EventGuest };

type GuestRow = {
  id: string;
  event_id: string;
  name: string;
  phone: string;
  created_at: string;
  invite_token_hash?: string | null;
  invite_token_enc?: string | null;
};

export async function requireHostEventSession(eventId: string) {
  if (!eventId) {
    return null;
  }
  const jar = await cookies();
  const session = readHostSessionToken(jar.get(HOST_SESSION_COOKIE)?.value);
  if (!session || session.eventId !== eventId) {
    return null;
  }
  return session;
}

function toGuest(row: GuestRow, invitePath = ""): EventGuest {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    phone: row.phone,
    createdAt: row.created_at,
    invitePath,
  };
}

let redisplayFailureLogged = false;

function noteRedisplayFailure(eventId: string) {
  if (redisplayFailureLogged) {
    return;
  }
  redisplayFailureLogged = true;
  console.error(
    "[LOLO] Could not redisplay an invite link; the stored hash was left unchanged",
    { eventId },
  );
}

async function persistInviteCredentials(
  eventId: string,
  guestId: string,
  credentials: ReturnType<typeof createInviteCredentials>,
) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("event_guests")
    .update({
      invite_token_hash: credentials.hash,
      invite_token_enc: credentials.enc,
    })
    .eq("id", guestId)
    .eq("event_id", eventId);

  if (error) {
    throw new Error("שמירת קישור ההזמנה נכשלה.");
  }
}

async function invitePathForRow(row: GuestRow) {
  if (row.invite_token_hash) {
    if (row.invite_token_enc) {
      try {
        const token = decryptInviteToken(row.invite_token_enc);
        if (token && hashInviteToken(token) === row.invite_token_hash) {
          return inviteTokenPath(token);
        }
      } catch (error) {
        console.error("[LOLO] Invite link decrypt failed", {
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    }
    noteRedisplayFailure(row.event_id);
    return "";
  }

  const credentials = createInviteCredentials();
  await persistInviteCredentials(row.event_id, row.id, credentials);
  return credentials.path;
}

export async function listEventGuests(eventId: string): Promise<EventGuest[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("event_guests")
    .select(
      "id, event_id, name, phone, created_at, invite_token_hash, invite_token_enc",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("טעינת רשימת האורחים נכשלה.");
  }

  const rows = ((data ?? []) as GuestRow[]).filter(
    (row) => row.event_id === eventId,
  );

  const guests: EventGuest[] = [];
  for (const row of rows) {
    const invitePath = await invitePathForRow(row);
    guests.push(toGuest(row, invitePath));
  }
  return guests;
}

export async function insertEventGuests(
  eventId: string,
  guests: { name: string; phone: string }[],
) {
  if (guests.length === 0) {
    return;
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("event_guests").insert(
    guests.map((guest) => {
      const credentials = createInviteCredentials();
      return {
        event_id: eventId,
        name: guest.name,
        phone: guest.phone,
        invite_token_hash: credentials.hash,
        invite_token_enc: credentials.enc,
      };
    }),
  );

  if (error) {
    throw new Error("שמירת רשימת האורחים נכשלה.");
  }
}

export async function addEventGuest(
  eventId: string,
  input: { name: string; phone: string },
): Promise<EventGuest> {
  const guest = parseGuestInput(input);
  const credentials = createInviteCredentials();
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("event_guests")
    .insert({
      event_id: eventId,
      name: guest.name,
      phone: guest.phone,
      invite_token_hash: credentials.hash,
      invite_token_enc: credentials.enc,
    })
    .select(
      "id, event_id, name, phone, created_at, invite_token_hash, invite_token_enc",
    )
    .single();

  if (error || !data) {
    throw new Error("הוספת האורח נכשלה.");
  }

  return toGuest(data as GuestRow, credentials.path);
}

export async function deleteEventGuest(eventId: string, guestId: string) {
  if (!eventId || !guestId) {
    throw new Error("הסרת האורח נכשלה.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error, count } = await supabase
    .from("event_guests")
    .delete({ count: "exact" })
    .eq("id", guestId)
    .eq("event_id", eventId)
    .select("id");

  if (error) {
    throw new Error("הסרת האורח נכשלה.");
  }

  const deletedCount = Array.isArray(data) ? data.length : count ?? 0;
  if (deletedCount < 1) {
    throw new Error("הסרת האורח נכשלה.");
  }
}

export async function resolveInviteToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const hash = hashInviteToken(trimmed);
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("event_guests")
    .select("id, event_id, name, phone")
    .eq("invite_token_hash", hash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, slug, title")
    .eq("id", data.event_id)
    .maybeSingle();

  if (!event || event.id !== data.event_id) {
    return null;
  }

  return {
    guestId: String(data.id),
    eventId: String(data.event_id),
    name: String(data.name || ""),
    phone: String(data.phone || ""),
    slug: String(event.slug || ""),
    title: String(event.title || ""),
  };
}
