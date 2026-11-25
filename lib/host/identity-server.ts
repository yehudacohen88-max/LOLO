import "server-only";
import { cookies } from "next/headers";
import {
  maskEmail,
  normalizeHostEmail,
  toHostEventSummary,
  type HostEventSummary,
} from "@/lib/host/identity-public";
import {
  HOST_IDENTITY_COOKIE,
  readHostIdentityToken,
} from "@/lib/host/identity-session";
import { hostSchemaUnavailable, isMissingRelation } from "@/lib/host/schema-error";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function readIdentitySession() {
  const jar = await cookies();
  return readHostIdentityToken(jar.get(HOST_IDENTITY_COOKIE)?.value);
}

export async function listLinkedHostEvents(identityId: string): Promise<HostEventSummary[]> {
  const supabase = getSupabaseServiceClient();
  const links = await supabase
    .from("host_identity_events")
    .select("event_id")
    .eq("host_identity_id", identityId);
  if (links.error) {
    if (isMissingRelation(links.error, "host_identity_events")) {
      throw hostSchemaUnavailable();
    }
    throw hostSchemaUnavailable();
  }
  const ids = (links.data ?? []).map((row) => String(row.event_id));
  if (ids.length === 0) {
    return [];
  }
  const events = await supabase
    .from("events")
    .select("id, title, event_date, slug")
    .in("id", ids);
  if (events.error) {
    throw new Error("טעינת האירועים נכשלה.");
  }
  return (events.data ?? []).map((row) =>
    toHostEventSummary({
      id: String(row.id),
      title: String(row.title || ""),
      event_date: String(row.event_date || ""),
      slug: String(row.slug || ""),
    }),
  );
}

export async function linkEventToEmail(input: {
  eventId: string;
  email: string;
  identityId: string | null;
}) {
  const email = normalizeHostEmail(input.email);
  if (!email) {
    throw new Error("נא להזין אימייל תקין.");
  }
  const supabase = getSupabaseServiceClient();
  const existing = await supabase
    .from("host_identity_events")
    .select("host_identity_id")
    .eq("event_id", input.eventId);
  if (existing.error) {
    if (isMissingRelation(existing.error, "host_identity_events")) {
      throw hostSchemaUnavailable();
    }
    throw hostSchemaUnavailable();
  }

  const linkedId = existing.data?.[0]?.host_identity_id
    ? String(existing.data[0].host_identity_id)
    : "";
  if (linkedId) {
    const identity = await supabase
      .from("host_identities")
      .select("id, email")
      .eq("id", linkedId)
      .maybeSingle();
    if (identity.error) {
      throw hostSchemaUnavailable();
    }
    if (normalizeHostEmail(String(identity.data?.email || "")) !== email) {
      throw new Error("לאירוע הזה כבר מקושר אימייל אחר.");
    }
    return { identityId: linkedId };
  }

  const found = await supabase
    .from("host_identities")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (found.error) {
    if (isMissingRelation(found.error, "host_identities")) {
      throw hostSchemaUnavailable();
    }
    throw hostSchemaUnavailable();
  }

  let identityId = found.data?.id ? String(found.data.id) : "";
  if (identityId && identityId !== input.identityId) {
    throw new Error("האימייל הזה כבר שמור. פתחו את האירועים שלי מאותו דפדפן, או שחזרו גישה.");
  }

  if (!identityId) {
    const inserted = await supabase
      .from("host_identities")
      .insert({ email })
      .select("id")
      .single();
    if (inserted.error || !inserted.data?.id) {
      const again = await supabase
        .from("host_identities")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (!again.data?.id) {
        throw hostSchemaUnavailable();
      }
      identityId = String(again.data.id);
      if (identityId !== input.identityId) {
        throw new Error("האימייל הזה כבר שמור. פתחו את האירועים שלי מאותו דפדפן, או שחזרו גישה.");
      }
    } else {
      identityId = String(inserted.data.id);
    }
  }

  const link = await supabase.from("host_identity_events").insert({
    host_identity_id: identityId,
    event_id: input.eventId,
    role: "owner",
    linked_via: "access_code",
  });
  if (link.error) {
    throw new Error("קישור האירוע נכשל.");
  }
  return { identityId };
}

export async function identityOwnsEvent(identityId: string, eventId: string) {
  const supabase = getSupabaseServiceClient();
  const link = await supabase
    .from("host_identity_events")
    .select("event_id")
    .eq("host_identity_id", identityId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (link.error) {
    if (isMissingRelation(link.error, "host_identity_events")) {
      throw hostSchemaUnavailable();
    }
    throw hostSchemaUnavailable();
  }
  return Boolean(link.data?.event_id);
}

export async function loadRecoveryChannel(eventId: string) {
  const supabase = getSupabaseServiceClient();
  const link = await supabase
    .from("host_identity_events")
    .select("host_identity_id")
    .eq("event_id", eventId)
    .limit(1);
  if (link.error) {
    if (isMissingRelation(link.error, "host_identity_events")) {
      return { state: "unavailable" as const };
    }
    console.error("[LOLO] host recovery channel", { code: link.error.code });
    return { state: "unavailable" as const };
  }
  const identityId = link.data?.[0]?.host_identity_id
    ? String(link.data[0].host_identity_id)
    : "";
  if (!identityId) {
    return { state: "open" as const };
  }
  const identity = await supabase
    .from("host_identities")
    .select("email")
    .eq("id", identityId)
    .maybeSingle();
  if (identity.error || !identity.data) {
    return { state: "linked" as const, maskedEmail: "" };
  }
  return {
    state: "linked" as const,
    maskedEmail: maskEmail(String(identity.data.email || "")),
  };
}
