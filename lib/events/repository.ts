import { buildDemoEvent, DEMO_EVENT_SLUG } from "./demo";
import { normalizeEventSlug } from "./slug";
import type { PublishedHostEvent, StoredEvent } from "./types";

const LAST_CREATED_SLUG_KEY = "lolo-last-created-event-slug";

function rememberSlug(slug: string) {
  window.localStorage.setItem(LAST_CREATED_SLUG_KEY, slug);
}

export async function getEventBySlug(slug: string): Promise<StoredEvent | null> {
  const decoded = normalizeEventSlug(slug);

  if (decoded === DEMO_EVENT_SLUG || slug === DEMO_EVENT_SLUG) {
    return buildDemoEvent();
  }

  if (typeof window === "undefined" || !decoded) {
    return null;
  }

  const response = await fetch(`/api/events/${encodeURIComponent(decoded)}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { event?: StoredEvent };
  if (!payload.event || payload.event.slug !== decoded) {
    return null;
  }
  return payload.event;
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
        imageUrl: gift.imageUrl,
        source: gift.source,
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
