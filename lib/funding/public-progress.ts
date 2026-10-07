import "server-only";
import { buildDemoEvent, DEMO_EVENT_SLUG } from "@/lib/events/demo";
import { normalizeEventSlug } from "@/lib/events/slug";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";
import {
  calculateEventFunding,
  type EventFunding,
  type FundingPaymentStatus,
} from "./calculate";

type GiftTargetRow = {
  id: string;
  target_amount: number | string | null;
};

type OrderStatusRow = {
  id: string;
  payment_status: string;
};

type ItemAmountRow = {
  order_id: string;
  gift_id: string;
  amount: number | string;
};

function asStatus(value: string): FundingPaymentStatus {
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

function targetAmount(value: number | string | null) {
  const target = Number(value);
  return Number.isFinite(target) && target > 0 ? target : null;
}

export async function loadEventFunding(slug: string): Promise<EventFunding | null> {
  const decoded = normalizeEventSlug(slug);
  if (!decoded) {
    return null;
  }

  if (decoded === DEMO_EVENT_SLUG) {
    return calculateEventFunding({
      gifts: buildDemoEvent().gifts.map((gift) => ({
        id: gift.id,
        targetAmount: gift.targetAmount > 0 ? gift.targetAmount : null,
      })),
      orders: [],
      items: [],
    });
  }

  const supabase = getSupabaseServiceClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("slug", decoded)
    .maybeSingle();

  if (eventError) {
    console.error("[LOLO] funding event lookup failed", {
      code: eventError.code,
      message: eventError.message,
    });
    const unavailable = new Error(SERVICE_UNAVAILABLE_MESSAGE);
    unavailable.name = "ServiceUnavailableError";
    throw unavailable;
  }
  if (!event) {
    return null;
  }

  const { data: giftRows, error: giftError } = await supabase
    .from("event_gifts")
    .select("id, target_amount")
    .eq("event_id", event.id);

  if (giftError) {
    console.error("[LOLO] funding gift lookup failed", {
      code: giftError.code,
      message: giftError.message,
    });
    const unavailable = new Error(SERVICE_UNAVAILABLE_MESSAGE);
    unavailable.name = "ServiceUnavailableError";
    throw unavailable;
  }

  const { data: orderRows, error: orderError } = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("event_id", event.id);

  if (orderError) {
    console.error("[LOLO] funding order lookup failed", {
      code: orderError.code,
      message: orderError.message,
    });
    const unavailable = new Error(SERVICE_UNAVAILABLE_MESSAGE);
    unavailable.name = "ServiceUnavailableError";
    throw unavailable;
  }

  const orders = (orderRows ?? []) as OrderStatusRow[];
  let items: ItemAmountRow[] = [];
  if (orders.length > 0) {
    const { data: itemRows, error: itemError } = await supabase
      .from("order_items")
      .select("order_id, gift_id, amount")
      .in(
        "order_id",
        orders.map((order) => order.id),
      );
    if (itemError) {
      console.error("[LOLO] funding item lookup failed", {
        code: itemError.code,
        message: itemError.message,
      });
      const unavailable = new Error(SERVICE_UNAVAILABLE_MESSAGE);
      unavailable.name = "ServiceUnavailableError";
      throw unavailable;
    }
    items = (itemRows ?? []) as ItemAmountRow[];
  }

  return calculateEventFunding({
    gifts: ((giftRows ?? []) as GiftTargetRow[]).map((gift) => ({
      id: String(gift.id),
      targetAmount: targetAmount(gift.target_amount),
    })),
    orders: orders.map((order) => ({
      id: String(order.id),
      paymentStatus: asStatus(order.payment_status),
    })),
    items: items.map((item) => ({
      orderId: String(item.order_id),
      giftId: String(item.gift_id),
      amount: Number(item.amount) || 0,
    })),
  });
}
