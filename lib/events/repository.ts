import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { buildDemoEvent, DEMO_EVENT_SLUG } from "./demo";
import { normalizeEventSlug } from "./slug";
import type { EventGift, PublishedHostEvent, StoredEvent } from "./types";

const LAST_CREATED_SLUG_KEY = "lolo-last-created-event-slug";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  host_name: string;
  event_type: string;
  event_date: string;
  event_time: string;
  venue_name: string;
  address: string;
  message: string;
  cover_image: string;
  gift_mode: string;
  money_amounts: number[] | null;
  allow_custom_amount: boolean;
  money_display: string;
  created_at: string;
  event_gifts?: GiftRow[] | null;
};

type GiftRow = {
  id: string;
  event_id: string;
  title: string;
  description: string;
  target_amount: number | string;
  icon: string;
  priority: number;
  active: boolean;
  store_id?: string | null;
  store_name?: string | null;
};

function requireClient() {
  if (typeof window === "undefined") {
    throw new Error("Cannot persist events on the server.");
  }

  if (!isSupabaseConfigured()) {
    console.error(
      "[LOLO] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    throw new Error("לא הצלחנו לטעון את הנתונים כרגע. נסו שוב בעוד רגע.");
  }

  return getSupabaseBrowserClient();
}

function toGift(row: GiftRow): EventGift {
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    description: row.description,
    targetAmount: Number(row.target_amount) || 0,
    icon: row.icon,
    priority: row.priority,
    active: row.active,
    storeId: row.store_id || null,
    storeName: row.store_name?.trim() ?? "",
  };
}

function toStoredEvent(row: EventRow): StoredEvent {
  const giftMode =
    row.gift_mode === "catalog" || row.gift_mode === "money"
      ? row.gift_mode
      : "";

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    hostName: row.host_name,
    eventType: row.event_type,
    date: row.event_date,
    time: row.event_time,
    venueName: row.venue_name,
    address: row.address,
    message: row.message,
    coverImage: row.cover_image,
    giftMode,
    moneyAmounts: Array.isArray(row.money_amounts) ? row.money_amounts : [],
    allowCustomAmount: row.allow_custom_amount,
    moneyDisplay: row.money_display === "hidden" ? "hidden" : "amounts",
    gifts: (row.event_gifts ?? [])
      .map(toGift)
      .sort((a, b) => a.priority - b.priority),
    createdAt: row.created_at,
  };
}

function rememberSlug(slug: string) {
  window.localStorage.setItem(LAST_CREATED_SLUG_KEY, slug);
}

function logSupabase(label: string, payload: unknown) {
  console.info(`[LOLO] ${label}`, payload);
}

export async function listEvents(): Promise<StoredEvent[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("events")
    .select("*");

  if (error) {
    logSupabase("listEvents error", {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    throw new Error("טעינת האירועים נכשלה.");
  }

  const events = data ?? [];
  const withGifts = await Promise.all(
    events.map(async (row) => {
      const gifts = await fetchGiftsForEvent(String(row.id));
      return toStoredEvent({ ...(row as EventRow), event_gifts: gifts });
    }),
  );

  return withGifts;
}

export async function listEventSlugs(): Promise<string[]> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return [];
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("events").select("slug");

  if (error) {
    logSupabase("listEventSlugs error", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return [];
  }

  return (data ?? []).map((row) => String(row.slug));
}

async function fetchGiftsForEvent(eventId: string): Promise<GiftRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("event_gifts")
    .select("*")
    .eq("event_id", eventId)
    .order("priority", { ascending: true });

  if (error) {
    logSupabase("fetchGiftsForEvent error", {
      eventId,
      message: error.message,
      code: error.code,
    });
    return [];
  }

  return (data ?? []) as GiftRow[];
}

export async function getEventBySlug(slug: string): Promise<StoredEvent | null> {
  const decoded = normalizeEventSlug(slug);

  logSupabase("getEventBySlug query", { raw: slug, decoded });

  if (decoded === DEMO_EVENT_SLUG || slug === DEMO_EVENT_SLUG) {
    return buildDemoEvent();
  }

  if (typeof window === "undefined" || !isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", decoded)
    .maybeSingle();

  if (error) {
    logSupabase("getEventBySlug error", {
      decoded,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  if (!data) {
    logSupabase("getEventBySlug empty", { decoded });
    return null;
  }

  const gifts = await fetchGiftsForEvent(String(data.id));
  const stored = toStoredEvent({ ...(data as EventRow), event_gifts: gifts });
  logSupabase("getEventBySlug stored", {
    id: stored.id,
    slug: stored.slug,
    giftCount: stored.gifts.length,
  });
  return stored;
}

export async function getEventGifts(eventId: string): Promise<EventGift[]> {
  if (eventId === buildDemoEvent().id) {
    return buildDemoEvent().gifts;
  }

  if (typeof window === "undefined" || !isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("event_gifts")
    .select("*")
    .eq("event_id", eventId)
    .eq("active", true)
    .order("priority", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => toGift(row as GiftRow));
}

export async function createEvent(
  event: StoredEvent,
  guests: { name: string; phone: string }[] = [],
): Promise<PublishedHostEvent> {
  if (typeof window === "undefined") {
    throw new Error("Cannot persist events on the server.");
  }

  const response = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: event.title,
      hostName: event.hostName,
      eventType: event.eventType,
      date: event.date,
      time: event.time,
      venueName: event.venueName,
      address: event.address,
      message: event.message,
      coverImage: event.coverImage,
      giftMode: event.giftMode,
      moneyAmounts: event.moneyAmounts,
      allowCustomAmount: event.allowCustomAmount,
      moneyDisplay: event.moneyDisplay,
      gifts: event.gifts.map((gift) => ({
        title: gift.title,
        description: gift.description,
        targetAmount: gift.targetAmount,
        icon: gift.icon,
        priority: gift.priority,
        active: gift.active,
        storeId: gift.storeId,
      })),
      guests: guests.map((guest) => ({
        name: guest.name,
        phone: guest.phone,
      })),
    }),
  });

  const payload = (await response.json()) as {
    id?: string;
    slug?: string;
    accessCode?: string;
    event?: StoredEvent;
    error?: string;
  };

  if (!response.ok || !payload.event || !payload.slug) {
    throw new Error(payload.error || "שמירת האירוע נכשלה.");
  }

  rememberSlug(payload.slug);
  return {
    ...payload.event,
    accessCode: payload.accessCode,
  };
}

export async function updateEvent(event: StoredEvent): Promise<StoredEvent> {
  return createEvent(event, []);
}

export function getLastCreatedSlug() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(LAST_CREATED_SLUG_KEY) ?? "";
}

export function guestEventPath(slug: string, rest = "") {
  const base = `/e/${encodeURIComponent(normalizeEventSlug(slug))}`;
  return rest ? `${base}/${rest}` : base;
}
