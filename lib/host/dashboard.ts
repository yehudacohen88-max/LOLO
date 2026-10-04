import { listEventGuests } from "@/lib/host/guest-list";
import type { EventGuest } from "@/lib/host/guest-fields";
import { normalizeEventSlug } from "@/lib/events/slug";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type HostPaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type HostDashboardGift = {
  id: string;
  title: string;
  icon: string;
  storeName: string;
  targetAmount: number | null;
  paidAmount: number;
  pendingAmount: number;
};

export type HostDashboardOrder = {
  id: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  createdAt: string;
  totalAmount: number;
  paymentStatus: HostPaymentStatus;
};

export type HostDashboardData = {
  eventId: string;
  title: string;
  eventType: string;
  eventDate: string;
  hostName: string;
  slug: string;
  guestPath: string;
  paidAmount: number;
  pendingAmount: number;
  paidOrderCount: number;
  pendingOrderCount: number;
  gifts: HostDashboardGift[];
  orders: HostDashboardOrder[];
  invitedGuests: EventGuest[];
};

type OrderRow = {
  id: string;
  event_id: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  total_amount: number | string;
  payment_status: string;
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

export async function getHostDashboardData(
  eventId: string,
): Promise<HostDashboardData | null> {
  const supabase = getSupabaseServiceClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, slug, title, host_name, event_type, event_date")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event) {
    return null;
  }

  const withStoreName = await supabase
    .from("event_gifts")
    .select("id, title, icon, target_amount, priority, store_name")
    .eq("event_id", eventId)
    .order("priority", { ascending: true });
  const giftResult = withStoreName.error
    ? await supabase
        .from("event_gifts")
        .select("id, title, icon, target_amount, priority")
        .eq("event_id", eventId)
        .order("priority", { ascending: true })
    : withStoreName;
  const giftRows = (giftResult.data ?? []) as Array<{
    id: string;
    title: string;
    icon: string;
    target_amount: number | string | null;
    priority: number;
    store_name?: string | null;
  }>;

  const { data: orderRows } = await supabase
    .from("orders")
    .select(
      "id, event_id, guest_name, guest_phone, guest_email, total_amount, payment_status, created_at",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

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

  const statusByOrderId = new Map(
    orders.map((order) => [order.id, asStatus(order.payment_status)]),
  );

  const paidByGift = new Map<string, number>();
  const pendingByGift = new Map<string, number>();

  for (const item of itemRows) {
    const status = statusByOrderId.get(item.order_id);
    if (!status) {
      continue;
    }
    const amount = asAmount(item.amount);
    if (status === "paid") {
      paidByGift.set(item.gift_id, roundAmount((paidByGift.get(item.gift_id) ?? 0) + amount));
    } else if (status === "pending") {
      pendingByGift.set(
        item.gift_id,
        roundAmount((pendingByGift.get(item.gift_id) ?? 0) + amount),
      );
    }
  }

  const paidOrders = orders.filter((order) => asStatus(order.payment_status) === "paid");
  const pendingOrders = orders.filter(
    (order) => asStatus(order.payment_status) === "pending",
  );

  return {
    eventId: event.id,
    title: String(event.title || ""),
    eventType: String(event.event_type || ""),
    eventDate: String(event.event_date || ""),
    hostName: String(event.host_name || ""),
    slug: String(event.slug || ""),
    guestPath: guestEventPath(String(event.slug || "")),
    paidAmount: roundAmount(
      paidOrders.reduce((sum, order) => sum + asAmount(order.total_amount), 0),
    ),
    pendingAmount: roundAmount(
      pendingOrders.reduce((sum, order) => sum + asAmount(order.total_amount), 0),
    ),
    paidOrderCount: paidOrders.length,
    pendingOrderCount: pendingOrders.length,
    gifts: (giftRows ?? []).map((gift) => {
      const target = Number(gift.target_amount);
      return {
        id: String(gift.id),
        title: String(gift.title || ""),
        icon: String(gift.icon || ""),
        storeName: String(gift.store_name || "").trim(),
        targetAmount: Number.isFinite(target) && target > 0 ? target : null,
        paidAmount: paidByGift.get(String(gift.id)) ?? 0,
        pendingAmount: pendingByGift.get(String(gift.id)) ?? 0,
      };
    }),
    orders: orders.map((order) => ({
      id: order.id,
      guestName: String(order.guest_name || "").trim(),
      guestPhone: String(order.guest_phone || "").trim(),
      guestEmail: String(order.guest_email || "").trim(),
      createdAt: order.created_at,
      totalAmount: asAmount(order.total_amount),
      paymentStatus: asStatus(order.payment_status),
    })),
    invitedGuests: await listEventGuests(eventId),
  };
}
