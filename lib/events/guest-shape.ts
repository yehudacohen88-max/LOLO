import type { EventGift, StoredEvent } from "./types";

export const GUEST_EVENT_FIELDS = [
  "id",
  "slug",
  "title",
  "hostName",
  "eventType",
  "date",
  "time",
  "venueName",
  "address",
  "message",
  "coverImage",
  "giftMode",
  "moneyAmounts",
  "allowCustomAmount",
  "moneyDisplay",
  "gifts",
  "createdAt",
] as const;

export type GuestEventRow = {
  id: string;
  slug: string;
  title?: string | null;
  host_name?: string | null;
  event_type?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  venue_name?: string | null;
  address?: string | null;
  message?: string | null;
  cover_image?: string | null;
  gift_mode?: string | null;
  money_amounts?: number[] | null;
  allow_custom_amount?: boolean | null;
  money_display?: string | null;
  created_at?: string | null;
};

export type GuestGiftRow = {
  id: string;
  event_id: string;
  title?: string | null;
  description?: string | null;
  target_amount?: number | string | null;
  icon?: string | null;
  image_url?: string | null;
  source?: string | null;
  priority?: number | null;
  active?: boolean | null;
  store_name?: string | null;
};

function text(value: string | null | undefined) {
  return String(value ?? "");
}

function toGift(row: GuestGiftRow): EventGift {
  const source = row.source === "custom" || row.source === "catalog" ? row.source : "";
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    title: text(row.title),
    description: text(row.description),
    targetAmount: Number(row.target_amount) || 0,
    icon: text(row.icon),
    imageUrl: text(row.image_url).trim(),
    source,
    priority: Number(row.priority) || 0,
    active: row.active !== false,
    storeId: null,
    storeName: text(row.store_name).trim(),
  };
}

export function mapGuestEvent(row: GuestEventRow, gifts: GuestGiftRow[]): StoredEvent {
  const giftMode =
    row.gift_mode === "catalog" || row.gift_mode === "money" ? row.gift_mode : "";

  return {
    id: String(row.id),
    slug: String(row.slug),
    title: text(row.title),
    hostName: text(row.host_name),
    eventType: text(row.event_type),
    date: text(row.event_date),
    time: text(row.event_time),
    venueName: text(row.venue_name),
    address: text(row.address),
    message: text(row.message),
    coverImage: text(row.cover_image),
    giftMode,
    moneyAmounts: Array.isArray(row.money_amounts)
      ? row.money_amounts.map(Number).filter((amount) => Number.isFinite(amount))
      : [],
    allowCustomAmount: row.allow_custom_amount !== false,
    moneyDisplay: row.money_display === "hidden" ? "hidden" : "amounts",
    gifts: gifts.map(toGift).sort((left, right) => left.priority - right.priority),
    createdAt: text(row.created_at),
  };
}

export function anonCatalogIsClosed(status: number, rowCount: number) {
  if (status === 401 || status === 403) {
    return true;
  }
  return status === 200 && rowCount === 0;
}
