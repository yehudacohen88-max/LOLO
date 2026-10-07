import "server-only";
import { getGuestFeeSettings } from "@/lib/admin/guest-fee";
import { buildDemoEvent, DEMO_EVENT_SLUG } from "@/lib/events/demo";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { normalizeEventSlug } from "@/lib/events/slug";
import { isValidEmail, isValidPhone } from "@/lib/guest-draft";
import { roundMoney } from "@/lib/money";
import {
  calculateGuestFee,
  GUEST_FEE_OFF,
  orderMoneyFromRow,
} from "@/lib/payments/fee";
import { rethrowIfCheckoutSchema } from "@/lib/payments/schema-error";
import { decideMarkFailed, decideMarkPaid } from "@/lib/payments/state";
import type { CheckoutAmounts } from "@/lib/payments/fee";
import type { MarkPaidAttempt } from "@/lib/payments/state";
import type { StoredEvent } from "@/lib/events/types";
import type { PaymentStatus, StoredOrder, UpsertOrderInput } from "./types";

type GiftRow = {
  id: string;
  event_id: string;
  title: string;
  description: string;
  target_amount: number | string;
  icon: string;
  image_url?: string | null;
  source?: string | null;
  priority: number;
  active: boolean;
  store_id?: string | null;
  store_name?: string | null;
};

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
};

function toEvent(row: EventRow, gifts: GiftRow[]): StoredEvent {
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
    gifts: gifts
      .filter((gift) => gift.active !== false)
      .sort((a, b) => a.priority - b.priority)
      .map((gift) => ({
        id: gift.id,
        eventId: gift.event_id,
        title: gift.title,
        description: gift.description,
        targetAmount: Number(gift.target_amount) || 0,
        icon: gift.icon,
        imageUrl: gift.image_url?.trim() ?? "",
        source: gift.source === "custom" || gift.source === "catalog" ? gift.source : "",
        priority: gift.priority,
        active: gift.active,
        storeId: gift.store_id || null,
        storeName: gift.store_name?.trim() ?? "",
      })),
    createdAt: row.created_at,
  };
}

async function getEventBySlugServer(slug: string): Promise<StoredEvent | null> {
  const decoded = normalizeEventSlug(slug);
  if (!decoded || decoded === DEMO_EVENT_SLUG) {
    return null;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", decoded)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const { data: gifts } = await supabase
    .from("event_gifts")
    .select("*")
    .eq("event_id", data.id)
    .order("priority", { ascending: true });

  return toEvent(data as EventRow, (gifts ?? []) as GiftRow[]);
}

function roundAmount(value: number) {
  return roundMoney(value);
}

type OrderWriteError = { code?: string; message?: string };

function failOrderWrite(error: OrderWriteError, fallback: string): never {
  rethrowIfCheckoutSchema(error);
  console.error("[LOLO] order write failed", {
    code: error.code,
    message: error.message,
  });
  throw new Error(fallback);
}

function asPaymentStatus(value: string): PaymentStatus {
  if (
    value === "paid" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "pending"
  ) {
    return value;
  }
  return "pending";
}

function mapStoredOrder(
  order: {
    id: string;
    event_id: string;
    event_slug: string;
    guest_name: string;
    total_amount?: number | string | null;
    fee_amount?: number | string | null;
    charged_amount?: number | string | null;
    payment_status: string;
    payment_provider?: string | null;
    payment_reference?: string | null;
    paid_at?: string | null;
    access_token: string;
  },
  items: { gift_id: string; gift_name: string; amount: number | string }[],
): StoredOrder {
  const money = orderMoneyFromRow(order);
  return {
    id: order.id,
    eventId: order.event_id,
    eventSlug: order.event_slug,
    guestName: order.guest_name,
    totalAmount: money.contributionAmount,
    contributionAmount: money.contributionAmount,
    feeAmount: money.feeAmount,
    chargedAmount: money.chargedAmount,
    paymentStatus: asPaymentStatus(order.payment_status),
    paymentProvider: order.payment_provider ?? null,
    paymentReference: order.payment_reference ?? null,
    paidAt: order.paid_at ?? null,
    accessToken: order.access_token,
    items: items.map((item) => ({
      giftId: String(item.gift_id),
      giftName: String(item.gift_name),
      amount: roundAmount(Number(item.amount) || 0),
    })),
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function buildContribution(
  event: StoredEvent,
  itemInputs: UpsertOrderInput["items"],
  requireUuid: boolean,
) {
  const giftsById = new Map(event.gifts.map((gift) => [gift.id, gift]));
  const merged = new Map<string, number>();

  for (const item of itemInputs) {
    const amount = roundAmount(Number(item.amount));
    if (!item.giftId || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    if (requireUuid && !isUuid(item.giftId)) {
      throw new Error("נבחרה מתנה שאינה שייכת לאירוע.");
    }
    const gift = giftsById.get(item.giftId);
    if (!gift || gift.eventId !== event.id) {
      throw new Error("נבחרה מתנה שאינה שייכת לאירוע.");
    }
    merged.set(item.giftId, roundAmount((merged.get(item.giftId) ?? 0) + amount));
  }

  const items = [...merged.entries()].map(([giftId, amount]) => {
    const gift = giftsById.get(giftId);
    return {
      gift_id: giftId,
      gift_name: gift?.title ?? "",
      amount,
    };
  });

  if (items.length === 0) {
    throw new Error("נא לבחור לפחות מתנה אחת.");
  }

  const totalAmount = roundAmount(items.reduce((sum, item) => sum + item.amount, 0));
  return { items, totalAmount };
}

export async function quoteContribution(
  slug: string,
  itemInputs: UpsertOrderInput["items"],
): Promise<CheckoutAmounts & { feeEnabled: boolean }> {
  const decoded = normalizeEventSlug(slug);
  if (decoded === DEMO_EVENT_SLUG) {
    const contribution = buildContribution(buildDemoEvent(), itemInputs, false);
    return {
      ...calculateGuestFee(contribution.totalAmount, GUEST_FEE_OFF),
      feeEnabled: false,
    };
  }

  const event = await getEventBySlugServer(slug);
  if (!event) {
    throw new Error("האירוע לא נמצא.");
  }

  const contribution = buildContribution(event, itemInputs, true);
  const settings = await getGuestFeeSettings();
  return {
    ...calculateGuestFee(contribution.totalAmount, settings),
    feeEnabled: settings.enabled,
  };
}

export async function upsertPendingOrder(
  input: UpsertOrderInput,
): Promise<StoredOrder> {
  const decoded = normalizeEventSlug(input.slug);
  if (decoded === DEMO_EVENT_SLUG) {
    throw new Error("תשלום הדגמה זמין באירוע שפורסם.");
  }

  const event = await getEventBySlugServer(input.slug);
  if (!event) {
    throw new Error("האירוע לא נמצא.");
  }

  const guestName = input.guestName.trim();
  const guestPhone = input.guestPhone.trim();
  const guestEmail = input.guestEmail.trim();

  if (!guestName) {
    throw new Error("נא להזין שם מלא");
  }
  if (!isValidPhone(guestPhone)) {
    throw new Error("נא להזין מספר טלפון תקין");
  }
  if (!isValidEmail(guestEmail)) {
    throw new Error("נא להזין כתובת אימייל תקינה");
  }

  const contribution = buildContribution(event, input.items, true);
  const items = contribution.items;
  const settings = await getGuestFeeSettings();
  const money = calculateGuestFee(contribution.totalAmount, settings);

  const supabase = getSupabaseServiceClient();
  const greetingText = input.greetingText.trim();

  let orderId = input.orderId?.trim() || "";
  let accessToken = input.accessToken?.trim() || "";

  if (orderId) {
    const { data: existing, error: existingError } = await supabase
      .from("orders")
      .select("id, event_id, payment_status, access_token")
      .eq("id", orderId)
      .maybeSingle();

    if (existingError || !existing) {
      orderId = "";
      accessToken = "";
    } else if (existing.access_token !== accessToken) {
      throw new Error("לא ניתן לעדכן את ההזמנה.");
    } else if (existing.event_id !== event.id) {
      throw new Error("לא ניתן לעדכן את ההזמנה.");
    } else if (
      existing.payment_status !== "pending" &&
      existing.payment_status !== "failed"
    ) {
      throw new Error("ההזמנה כבר אינה ממתינה לתשלום.");
    } else {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          event_slug: event.slug,
          guest_name: guestName,
          guest_phone: guestPhone,
          guest_email: guestEmail,
          wants_confirmation: input.wantsConfirmation !== false,
          greeting_text: greetingText,
          total_amount: money.contributionAmount,
          fee_amount: money.feeAmount,
          charged_amount: money.chargedAmount,
          payment_status: "pending",
          payment_provider: null,
          payment_reference: null,
          paid_at: null,
        })
        .eq("id", orderId);

      if (updateError) {
        failOrderWrite(updateError, "שמירת ההזמנה נכשלה.");
      }

      const { error: deleteError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);

      if (deleteError) {
        throw new Error("שמירת ההזמנה נכשלה.");
      }
    }
  }

  if (!orderId) {
    const { data: created, error: createError } = await supabase
      .from("orders")
      .insert({
        event_id: event.id,
        event_slug: event.slug,
        guest_name: guestName,
        guest_phone: guestPhone,
        guest_email: guestEmail,
        wants_confirmation: input.wantsConfirmation !== false,
        greeting_text: greetingText,
        total_amount: money.contributionAmount,
        fee_amount: money.feeAmount,
        charged_amount: money.chargedAmount,
        payment_status: "pending",
      })
      .select("id, access_token")
      .single();

    if (createError || !created) {
      if (createError) {
        failOrderWrite(createError, "שמירת ההזמנה נכשלה.");
      }
      throw new Error("שמירת ההזמנה נכשלה.");
    }

    orderId = created.id;
    accessToken = created.access_token;
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    items.map((item) => ({
      order_id: orderId,
      gift_id: item.gift_id,
      gift_name: item.gift_name,
      amount: item.amount,
    })),
  );

  if (itemsError) {
    throw new Error("שמירת פריטי ההזמנה נכשלה.");
  }

  return {
    id: orderId,
    eventId: event.id,
    eventSlug: event.slug,
    guestName,
    totalAmount: money.contributionAmount,
    contributionAmount: money.contributionAmount,
    feeAmount: money.feeAmount,
    chargedAmount: money.chargedAmount,
    paymentStatus: "pending",
    paymentProvider: null,
    paymentReference: null,
    paidAt: null,
    accessToken,
    items: items.map((item) => ({
      giftId: item.gift_id,
      giftName: item.gift_name,
      amount: item.amount,
    })),
  };
}

export async function getOrderForGuest(
  orderId: string,
  accessToken: string,
): Promise<StoredOrder | null> {
  const supabase = getSupabaseServiceClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("access_token", accessToken)
    .maybeSingle();

  if (error || !order) {
    return null;
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  return mapStoredOrder(order, items ?? []);
}

function snapshotOf(order: StoredOrder) {
  return {
    paymentStatus: order.paymentStatus,
    paymentProvider: order.paymentProvider,
    paymentReference: order.paymentReference,
    paidAt: order.paidAt,
  };
}

export async function markOrderPaid(
  orderId: string,
  accessToken: string,
  attempt: MarkPaidAttempt,
): Promise<StoredOrder> {
  if (!/^[a-z0-9_-]{1,40}$/.test(attempt.provider)) {
    throw new Error("אישור התשלום נכשל.");
  }
  if (!/^[\w-]{1,80}$/.test(attempt.paymentReference) || !attempt.paidAt) {
    throw new Error("אישור התשלום נכשל.");
  }

  const current = await getOrderForGuest(orderId, accessToken);
  if (!current) {
    throw new Error("ההזמנה לא נמצאה.");
  }

  const decision = decideMarkPaid(snapshotOf(current), attempt);
  if (decision.action === "reject") {
    throw new Error("לא ניתן לאשר את התשלום.");
  }
  if (decision.action === "already_paid") {
    return current;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      payment_provider: decision.snapshot.paymentProvider,
      payment_reference: decision.snapshot.paymentReference,
      paid_at: decision.snapshot.paidAt,
    })
    .eq("id", orderId)
    .eq("access_token", accessToken)
    .in("payment_status", ["pending", "failed"])
    .select("id")
    .maybeSingle();

  if (error) {
    failOrderWrite(error, "אישור התשלום נכשל.");
  }
  if (!data) {
    const raced = await getOrderForGuest(orderId, accessToken);
    if (raced?.paymentStatus === "paid") {
      return raced;
    }
    throw new Error("לא ניתן לאשר את התשלום.");
  }

  const paid = await getOrderForGuest(orderId, accessToken);
  if (!paid) {
    throw new Error("אישור התשלום נכשל.");
  }
  return paid;
}

export async function markOrderFailed(
  orderId: string,
  accessToken: string,
  provider: string,
): Promise<StoredOrder> {
  const current = await getOrderForGuest(orderId, accessToken);
  if (!current) {
    throw new Error("ההזמנה לא נמצאה.");
  }

  const decision = decideMarkFailed(snapshotOf(current), provider);
  if (decision.action === "reject") {
    throw new Error("לא ניתן לעדכן את התשלום.");
  }
  if (decision.action === "already_paid" || decision.action === "already_failed") {
    return current;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .update({
      payment_status: "failed",
      payment_provider: decision.snapshot.paymentProvider,
      payment_reference: decision.snapshot.paymentReference,
      paid_at: decision.snapshot.paidAt,
    })
    .eq("id", orderId)
    .eq("access_token", accessToken)
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    failOrderWrite(error, "עדכון התשלום נכשל.");
  }
  if (!data) {
    const raced = await getOrderForGuest(orderId, accessToken);
    if (raced?.paymentStatus === "paid" || raced?.paymentStatus === "failed") {
      return raced;
    }
    throw new Error("לא ניתן לעדכן את התשלום.");
  }

  const failed = await getOrderForGuest(orderId, accessToken);
  if (!failed) {
    throw new Error("עדכון התשלום נכשל.");
  }
  return failed;
}
