import type { Db } from "@/lib/desk/db";
import { isMissingColumn, isMissingRelation, rowsOf } from "@/lib/desk/db";
import { roundMoney } from "@/lib/money";
import { isUuid } from "@/lib/vouchers/input";

export const EVENT_LIST_COLUMNS =
  "id, slug, title, host_name, event_type, event_date, venue_name, created_at";

export const EVENT_DETAIL_COLUMNS =
  "id, slug, title, host_name, event_type, event_date, event_time, venue_name, address, message, gift_mode, created_at";

export const ORDER_LIST_COLUMNS =
  "id, event_id, event_slug, guest_name, payment_status, total_amount, payment_provider, payment_reference, created_at";

export const ORDER_DETAIL_COLUMNS =
  "id, event_id, event_slug, guest_name, guest_phone, guest_email, greeting_text, wants_confirmation, payment_status, total_amount, fee_amount, charged_amount, payment_provider, payment_reference, paid_at, created_at";

export const GUEST_COLUMNS = "id, event_id, name, phone, created_at";

export const GIFT_COLUMNS = "id, title, target_amount, active";

export const ITEM_COLUMNS = "id, gift_name, amount";

const SENSITIVE = /access_token|invite_token|code_hash|qr_secret|view_token/;

export function columnsArePublic(columns: string) {
  return !SENSITIVE.test(columns);
}

export type DeskEvent = {
  id: string;
  slug: string;
  title: string;
  hostName: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  address: string;
  message: string;
  giftMode: string;
  createdAt: string;
};

export type DeskOrder = {
  id: string;
  eventId: string;
  eventSlug: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  greetingText: string;
  wantsConfirmation: boolean;
  paymentStatus: string;
  totalAmount: number;
  feeAmount: number | null;
  chargedAmount: number | null;
  paymentProvider: string | null;
  paymentReference: string | null;
  paymentColumns: boolean;
  paidAt: string | null;
  createdAt: string;
};

export type DeskGuest = {
  id: string;
  eventId: string;
  name: string;
  phone: string;
  createdAt: string;
};

export type DeskGift = {
  id: string;
  title: string;
  targetAmount: number;
  active: boolean;
};

export type DeskItem = {
  id: string;
  giftName: string;
  amount: number;
};

type EventRow = {
  id: string;
  slug: string;
  title: string;
  host_name: string;
  event_type: string;
  event_date: string;
  event_time?: string;
  venue_name: string;
  address?: string;
  message?: string;
  gift_mode?: string;
  created_at: string;
};

type OrderRow = {
  id: string;
  event_id: string;
  event_slug: string;
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  greeting_text?: string;
  wants_confirmation?: boolean;
  payment_status: string;
  total_amount: number | string;
  fee_amount?: number | string | null;
  charged_amount?: number | string | null;
  payment_provider?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  created_at: string;
};

function money(value: number | string | null | undefined) {
  return roundMoney(Number(value) || 0);
}

function toEvent(row: EventRow): DeskEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title || "",
    hostName: row.host_name || "",
    eventType: row.event_type || "",
    eventDate: row.event_date || "",
    eventTime: row.event_time || "",
    venueName: row.venue_name || "",
    address: row.address || "",
    message: row.message || "",
    giftMode: row.gift_mode || "",
    createdAt: row.created_at,
  };
}

function toOrder(row: OrderRow, paymentColumns: boolean): DeskOrder {
  return {
    id: row.id,
    eventId: row.event_id,
    eventSlug: row.event_slug,
    guestName: row.guest_name || "",
    guestPhone: row.guest_phone || "",
    guestEmail: row.guest_email || "",
    greetingText: row.greeting_text || "",
    wantsConfirmation: row.wants_confirmation !== false,
    paymentStatus: row.payment_status,
    totalAmount: money(row.total_amount),
    feeAmount: paymentColumns && row.fee_amount != null ? money(row.fee_amount) : null,
    chargedAmount:
      paymentColumns && row.charged_amount != null ? money(row.charged_amount) : null,
    paymentProvider: paymentColumns ? (row.payment_provider ?? null) : null,
    paymentReference: paymentColumns ? (row.payment_reference ?? null) : null,
    paymentColumns,
    paidAt: paymentColumns ? (row.paid_at ?? null) : null,
    createdAt: row.created_at,
  };
}

export function orderDemoFlag(order: Pick<DeskOrder, "paymentColumns" | "paymentProvider" | "paymentReference">) {
  if (!order.paymentColumns) {
    return "unknown" as const;
  }
  const provider = (order.paymentProvider ?? "").trim().toLowerCase();
  const reference = (order.paymentReference ?? "").trim();
  if (
    provider === "" ||
    provider === "demo" ||
    provider === "none" ||
    reference.startsWith("demo-")
  ) {
    return "demo" as const;
  }
  return "unmarked" as const;
}

export function orderDemoText(order: Pick<DeskOrder, "paymentColumns" | "paymentProvider" | "paymentReference">) {
  const flag = orderDemoFlag(order);
  if (flag === "unknown") {
    return "סימון ההדגמה עדיין לא זמין";
  }
  if (flag === "demo") {
    return "הדגמה";
  }
  return `אינו מסומן כהדגמה (${order.paymentProvider})`;
}

export function paymentStatusLabel(status: string) {
  switch (status) {
    case "paid":
      return "שולם";
    case "failed":
      return "נכשל";
    case "cancelled":
      return "בוטל";
    default:
      return "ממתין";
  }
}

function searchText(value: string | undefined) {
  return (value ?? "").replace(/[%_,()*]/g, "").trim().slice(0, 80).toLowerCase();
}

export async function listDeskEvents(db: Db, q?: string) {
  const result = await db
    .from("events")
    .select(EVENT_LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (result.error) {
    throw result.error;
  }
  const needle = searchText(q);
  return rowsOf<EventRow>(result)
    .map(toEvent)
    .filter((event) => {
      if (!needle) {
        return true;
      }
      return (
        event.title.toLowerCase().includes(needle) ||
        event.hostName.toLowerCase().includes(needle) ||
        event.slug.toLowerCase().includes(needle)
      );
    });
}

export async function getDeskEvent(id: string, db: Db) {
  if (!isUuid(id)) {
    return null;
  }
  const result = await db.from("events").select(EVENT_DETAIL_COLUMNS).eq("id", id).maybeSingle();
  if (result.error) {
    throw result.error;
  }
  return result.data ? toEvent(result.data as EventRow) : null;
}

export async function listEventGifts(eventId: string, db: Db) {
  const result = await db.from("event_gifts").select(GIFT_COLUMNS).eq("event_id", eventId).limit(40);
  if (result.error) {
    throw result.error;
  }
  return rowsOf<{ id: string; title: string; target_amount: number | string; active: boolean }>(
    result,
  ).map((row) => ({
    id: row.id,
    title: row.title || "",
    targetAmount: money(row.target_amount),
    active: row.active !== false,
  }));
}

async function loadOrders(columns: string, db: Db, status?: string) {
  let query = db.from("orders").select(columns).order("created_at", { ascending: false }).limit(200);
  if (status) {
    query = query.eq("payment_status", status);
  }
  return query;
}

export async function listDeskOrders(db: Db, status?: string) {
  let paymentColumns = true;
  let result = await loadOrders(ORDER_LIST_COLUMNS, db, status);
  if (
    result.error &&
    (isMissingColumn(result.error, "payment_provider") ||
      isMissingColumn(result.error, "payment_reference"))
  ) {
    paymentColumns = false;
    const basic =
      "id, event_id, event_slug, guest_name, payment_status, total_amount, created_at";
    result = await loadOrders(basic, db, status);
  }
  if (result.error) {
    if (isMissingRelation(result.error, "orders")) {
      return { paymentColumns: false, orders: [] as DeskOrder[] };
    }
    throw result.error;
  }
  return {
    paymentColumns,
    orders: rowsOf<OrderRow>(result).map((row) => toOrder(row, paymentColumns)),
  };
}

export async function getDeskOrder(id: string, db: Db) {
  if (!isUuid(id)) {
    return null;
  }
  let paymentColumns = true;
  let result = await db.from("orders").select(ORDER_DETAIL_COLUMNS).eq("id", id).maybeSingle();
  if (
    result.error &&
    (isMissingColumn(result.error, "payment_provider") ||
      isMissingColumn(result.error, "fee_amount") ||
      isMissingColumn(result.error, "charged_amount"))
  ) {
    paymentColumns = false;
    result = await db
      .from("orders")
      .select(
        "id, event_id, event_slug, guest_name, guest_phone, guest_email, greeting_text, wants_confirmation, payment_status, total_amount, created_at",
      )
      .eq("id", id)
      .maybeSingle();
  }
  if (result.error) {
    throw result.error;
  }
  return result.data ? toOrder(result.data as OrderRow, paymentColumns) : null;
}

export async function listOrderItems(orderId: string, db: Db) {
  const result = await db.from("order_items").select(ITEM_COLUMNS).eq("order_id", orderId).limit(20);
  if (result.error) {
    throw result.error;
  }
  return rowsOf<{ id: string; gift_name: string; amount: number | string }>(result).map((row) => ({
    id: row.id,
    giftName: row.gift_name || "",
    amount: money(row.amount),
  }));
}

export async function listDeskGuests(db: Db, eventId?: string) {
  let query = db
    .from("event_guests")
    .select(GUEST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (eventId && isUuid(eventId)) {
    query = query.eq("event_id", eventId);
  }
  const result = await query;
  if (result.error) {
    if (isMissingRelation(result.error, "event_guests")) {
      return [] as DeskGuest[];
    }
    throw result.error;
  }
  return rowsOf<{ id: string; event_id: string; name: string; phone: string; created_at: string }>(
    result,
  ).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    phone: row.phone,
    createdAt: row.created_at,
  }));
}
