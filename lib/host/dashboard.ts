import "server-only";
import { allocateVoucherPools, isSimulatedPayment, sumPaidPools } from "@/lib/vouchers/demo-funding";
import { calculateEventFunding } from "@/lib/funding/calculate";
import { listEventGuests } from "@/lib/host/guest-list";
import type { EventGuest } from "@/lib/host/guest-fields";
import { normalizeEventSlug } from "@/lib/events/slug";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  giftVoucherAmounts,
  loadHostVoucherContext,
} from "@/lib/vouchers/repository";
import type { HostGiftVoucher, VoucherStoreOption } from "@/lib/vouchers/types";

export type HostPaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type HostDashboardGift = {
  id: string;
  title: string;
  description: string;
  icon: string;
  imageUrl: string;
  storeId: string | null;
  storeName: string;
  targetAmount: number | null;
  paidAmount: number;
  pendingAmount: number;
  contributorCount: number;
  percentOfTarget: number | null;
  voucheredAmount: number;
  availableAmount: number;
  /** Simulated balance that can become a non-redeemable demo voucher. */
  demoAvailableAmount?: number;
  realPaidAmount?: number;
  simulatedPaidAmount?: number;
  vouchers: HostGiftVoucher[];
};

export type HostDashboardOrder = {
  id: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  greetingText: string;
  createdAt: string;
  totalAmount: number;
  paymentStatus: HostPaymentStatus;
  /** Paid by the demo provider. Not money the host received. */
  simulatedPayment?: boolean;
};

export type HostDashboardData = {
  eventId: string;
  title: string;
  eventType: string;
  eventDate: string;
  hostName: string;
  slug: string;
  coverImage: string;
  guestPath: string;
  paidAmount: number;
  realPaidAmount?: number;
  simulatedPaidAmount?: number;
  pendingAmount: number;
  paidOrderCount: number;
  pendingOrderCount: number;
  gifts: HostDashboardGift[];
  orders: HostDashboardOrder[];
  invitedGuests: EventGuest[];
  vouchersReady: boolean;
  voucherStores: VoucherStoreOption[];
};

type OrderRow = {
  id: string;
  event_id: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  greeting_text: string;
  total_amount: number | string;
  payment_status: string;
  payment_provider?: string | null;
  payment_reference?: string | null;
  created_at: string;
};

type ItemRow = {
  order_id: string;
  gift_id: string;
  amount: number | string;
};

function roundAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function asAmount(value: number | string) {
  return roundAmount(Number(value) || 0);
}

function asStatus(value: string): HostPaymentStatus {
  if (
    value === "pending" ||
    value === "paid" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }
  return "pending";
}

function guestEventPath(slug: string) {
  return `/e/${encodeURIComponent(normalizeEventSlug(slug))}`;
}

type HostGiftRow = {
  id: string;
  title: string;
  description?: string | null;
  icon: string;
  image_url?: string | null;
  target_amount: number | string | null;
  priority: number;
  store_id?: string | null;
  store_name?: string | null;
};

async function loadHostGiftRows(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  eventId: string,
) {
  const attempts = [
    () =>
      supabase
        .from("event_gifts")
        .select(
          "id, title, description, icon, image_url, target_amount, priority, store_name, store_id",
        )
        .eq("event_id", eventId)
        .order("priority", { ascending: true }),
    () =>
      supabase
        .from("event_gifts")
        .select("id, title, description, icon, target_amount, priority, store_name, store_id")
        .eq("event_id", eventId)
        .order("priority", { ascending: true }),
    () =>
      supabase
        .from("event_gifts")
        .select("id, title, description, icon, target_amount, priority")
        .eq("event_id", eventId)
        .order("priority", { ascending: true }),
    () =>
      supabase
        .from("event_gifts")
        .select("id, title, icon, target_amount, priority")
        .eq("event_id", eventId)
        .order("priority", { ascending: true }),
  ];

  for (const attempt of attempts) {
    const result = await attempt();
    if (!result.error) {
      return (result.data ?? []) as HostGiftRow[];
    }
    console.error("[LOLO] Host gift query failed for a column set.", {
      code: result.error.code,
      message: result.error.message,
    });
  }

  return [] as HostGiftRow[];
}

export async function getHostDashboardData(
  eventId: string,
): Promise<HostDashboardData | null> {
  const supabase = getSupabaseServiceClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, slug, title, host_name, event_type, event_date, cover_image")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event) {
    return null;
  }

  const giftRows = await loadHostGiftRows(supabase, eventId);

  const orderSelect =
    "id, event_id, guest_name, guest_phone, guest_email, greeting_text, total_amount, payment_status, payment_provider, payment_reference, created_at";
  const flaggedOrders = await supabase
    .from("orders")
    .select(orderSelect)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  const providerKnown = !flaggedOrders.error;
  const orderResult = flaggedOrders.error
    ? await supabase
        .from("orders")
        .select(
          "id, event_id, guest_name, guest_phone, guest_email, greeting_text, total_amount, payment_status, created_at",
        )
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
    : flaggedOrders;
  const orderRows = orderResult.data;

  const orders = ((orderRows ?? []) as OrderRow[]).filter(
    (order) => order.event_id === eventId,
  );
  const orderIds = orders.map((order) => order.id);

  let itemRows: ItemRow[] = [];
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, gift_id, amount")
      .in("order_id", orderIds);
    itemRows = (items ?? []) as ItemRow[];
  }

  const funding = calculateEventFunding({
    gifts: (giftRows ?? []).map((gift) => {
      const target = Number(gift.target_amount);
      return {
        id: String(gift.id),
        targetAmount: Number.isFinite(target) && target > 0 ? target : null,
      };
    }),
    orders: orders.map((order) => ({
      id: order.id,
      paymentStatus: asStatus(order.payment_status),
    })),
    items: itemRows.map((item) => ({
      orderId: String(item.order_id),
      giftId: String(item.gift_id),
      amount: asAmount(item.amount),
    })),
  });
  const fundingByGift = new Map(funding.gifts.map((gift) => [gift.giftId, gift]));
  const voucherContext = await loadHostVoucherContext(eventId);
  const orderById = new Map(orders.map((order) => [order.id, order]));

  const gifts = (giftRows ?? []).map((gift) => {
    const target = Number(gift.target_amount);
    const giftId = String(gift.id);
    const progress = fundingByGift.get(giftId);
    const paidAmount = progress?.raisedAmount ?? 0;
    const slices = itemRows
      .filter((item) => String(item.gift_id) === giftId)
      .map((item) => {
        const order = orderById.get(String(item.order_id));
        const status = asStatus(order?.payment_status ?? "");
        return {
          amount: asAmount(item.amount),
          paymentStatus: status,
          paymentProvider: providerKnown ? (order?.payment_provider ?? null) : "demo",
          paymentReference: providerKnown ? (order?.payment_reference ?? null) : "demo-unknown",
        };
      });
    const split = providerKnown
      ? sumPaidPools(slices)
      : { realPaid: 0, simulatedPaid: paidAmount };
    const bucket = voucherContext.byGift.get(giftId);
    const voucherAmounts = giftVoucherAmounts(paidAmount, bucket);
    const pools = allocateVoucherPools({
      realPaid: split.realPaid,
      simulatedPaid: split.simulatedPaid,
      vouchers: (bucket?.committed ?? []).map((row) => ({
        amount: row.amount,
        status: row.status,
        demoOnly: row.demoOnly ?? null,
      })),
    });
    return {
      id: giftId,
      title: String(gift.title || ""),
      description: String(gift.description || "").trim(),
      icon: String(gift.icon || ""),
      imageUrl: String(gift.image_url || "").trim(),
      storeId: gift.store_id ? String(gift.store_id) : null,
      storeName: String(gift.store_name || "").trim(),
      targetAmount: Number.isFinite(target) && target > 0 ? target : null,
      paidAmount,
      realPaidAmount: split.realPaid,
      simulatedPaidAmount: split.simulatedPaid,
      pendingAmount: progress?.pendingAmount ?? 0,
      contributorCount: progress?.contributorCount ?? 0,
      percentOfTarget: progress?.percentOfTarget ?? null,
      voucheredAmount: voucherAmounts.voucheredAmount,
      availableAmount: pools.monetaryAvailable,
      demoAvailableAmount: pools.demoAvailable,
      vouchers: voucherAmounts.vouchers,
    };
  });

  return {
    eventId: event.id,
    title: String(event.title || ""),
    eventType: String(event.event_type || ""),
    eventDate: String(event.event_date || ""),
    hostName: String(event.host_name || ""),
    slug: String(event.slug || ""),
    coverImage: String(event.cover_image || ""),
    guestPath: guestEventPath(String(event.slug || "")),
    paidAmount: funding.paidAmount,
    realPaidAmount: roundAmount(gifts.reduce((sum, gift) => sum + (gift.realPaidAmount ?? 0), 0)),
    simulatedPaidAmount: roundAmount(
      gifts.reduce((sum, gift) => sum + (gift.simulatedPaidAmount ?? 0), 0),
    ),
    pendingAmount: funding.pendingAmount,
    paidOrderCount: funding.paidOrderCount,
    pendingOrderCount: funding.pendingOrderCount,
    gifts,
    orders: orders.map((order) => {
      const status = asStatus(order.payment_status);
      const simulatedPayment =
        status === "paid" &&
        (!providerKnown ||
          isSimulatedPayment({
            amount: asAmount(order.total_amount),
            paymentStatus: "paid",
            paymentProvider: order.payment_provider ?? null,
            paymentReference: order.payment_reference ?? null,
          }));
      return {
        id: order.id,
        guestName: String(order.guest_name || "").trim(),
        guestPhone: String(order.guest_phone || "").trim(),
        guestEmail: String(order.guest_email || "").trim(),
        greetingText: String(order.greeting_text || "").trim(),
        createdAt: order.created_at,
        totalAmount: asAmount(order.total_amount),
        paymentStatus: status,
        simulatedPayment,
      };
    }),
    invitedGuests: await listEventGuests(eventId),
    vouchersReady: voucherContext.ready,
    voucherStores: voucherContext.stores,
  };
}
