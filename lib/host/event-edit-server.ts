import "server-only";
import { randomUUID } from "node:crypto";
import {
  planEventEdit,
  type EventEditCurrent,
  type EventEditGift,
  type EventEditLock,
  type EventEditPlan,
} from "@/lib/host/event-edit";
import { hostSchemaUnavailable, isMissingColumn, isMissingRelation } from "@/lib/host/schema-error";
import { isHostUploadImageUrl } from "@/lib/images/public-url";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type GiftRow = {
  id: string;
  title: string | null;
  description: string | null;
  target_amount: number | string | null;
  icon: string | null;
  image_url?: string | null;
  store_id?: string | null;
  priority: number | null;
  active: boolean | null;
};

function asGift(row: GiftRow): EventEditGift {
  const target = Number(row.target_amount);
  return {
    id: String(row.id),
    title: String(row.title || ""),
    description: String(row.description || ""),
    targetAmount: Number.isFinite(target) ? target : 0,
    icon: String(row.icon || "🎁"),
    imageUrl: String(row.image_url || ""),
    storeId: row.store_id ? String(row.store_id) : null,
    priority: Number(row.priority) || 0,
    active: row.active !== false,
  };
}

async function loadLocks(
  eventId: string,
  giftIds: string[],
): Promise<EventEditLock[]> {
  const supabase = getSupabaseServiceClient();
  const locks = new Map<string, EventEditLock>(
    giftIds.map((id) => [id, { id, orderCount: 0, paidAmount: 0, voucherCount: 0 }]),
  );
  const orders = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("event_id", eventId);
  if (orders.error) {
    throw new Error("טעינת ההזמנות נכשלה.");
  }
  const orderRows = orders.data ?? [];
  const paid = new Set(
    orderRows.filter((order) => order.payment_status === "paid").map((order) => String(order.id)),
  );
  const orderIds = orderRows.map((order) => String(order.id));
  if (orderIds.length > 0) {
    const items = await supabase
      .from("order_items")
      .select("order_id, gift_id, amount")
      .in("order_id", orderIds);
    if (items.error) {
      throw new Error("טעינת פריטי ההזמנה נכשלה.");
    }
    for (const item of items.data ?? []) {
      const giftId = String(item.gift_id);
      const lock = locks.get(giftId);
      if (!lock) {
        continue;
      }
      lock.orderCount += 1;
      if (paid.has(String(item.order_id))) {
        lock.paidAmount = Math.round((lock.paidAmount + Number(item.amount || 0)) * 100) / 100;
      }
    }
  }

  const vouchers = await supabase
    .from("vouchers")
    .select("gift_id, status")
    .eq("event_id", eventId);
  if (vouchers.error) {
    if (isMissingRelation(vouchers.error, "vouchers")) {
      throw hostSchemaUnavailable();
    }
    throw hostSchemaUnavailable();
  }
  for (const voucher of vouchers.data ?? []) {
    if (voucher.status === "CANCELLED") {
      continue;
    }
    const lock = locks.get(String(voucher.gift_id));
    if (lock) {
      lock.voucherCount += 1;
    }
  }
  return [...locks.values()];
}

async function storeNames(storeIds: string[]) {
  if (storeIds.length === 0) {
    return new Map<string, string>();
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, active")
    .in("id", storeIds)
    .eq("active", true);
  if (error) {
    throw new Error("טעינת החנויות נכשלה.");
  }
  return new Map(
    (data ?? []).map((store) => [String(store.id), String(store.name || "").trim()]),
  );
}

function throwIfWriteError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return;
  }
  if (
    isMissingColumn(error, "invitation_greeting") ||
    isMissingColumn(error, "store_id") ||
    isMissingColumn(error, "store_name") ||
    isMissingColumn(error, "image_url") ||
    isMissingColumn(error, "description")
  ) {
    throw hostSchemaUnavailable();
  }
  throw new Error("שמירת האירוע נכשלה.");
}

export async function editHostEvent(eventId: string, patch: Record<string, unknown>) {
  const supabase = getSupabaseServiceClient();
  const event = await supabase
    .from("events")
    .select(
      "id, slug, title, host_name, event_type, event_date, event_time, venue_name, address, message, cover_image",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (event.error || !event.data) {
    throw new Error("האירוע לא נמצא.");
  }

  const giftsResult = await supabase
    .from("event_gifts")
    .select("id, title, description, target_amount, icon, image_url, store_id, priority, active")
    .eq("event_id", eventId)
    .order("priority", { ascending: true });
  if (giftsResult.error) {
    throwIfWriteError(giftsResult.error);
    throw new Error("טעינת המתנות נכשלה.");
  }
  const currentGifts = ((giftsResult.data ?? []) as GiftRow[]).map(asGift);
  const current: EventEditCurrent = {
    slug: String(event.data.slug || ""),
    title: String(event.data.title || ""),
    hostName: String(event.data.host_name || ""),
    eventType: String(event.data.event_type || ""),
    date: String(event.data.event_date || ""),
    time: String(event.data.event_time || ""),
    venueName: String(event.data.venue_name || ""),
    address: String(event.data.address || ""),
    message: String(event.data.message || ""),
    coverImage: String(event.data.cover_image || ""),
    gifts: currentGifts,
  };

  const planned = planEventEdit({
    current,
    patch,
    locks: "gifts" in patch ? await loadLocks(eventId, currentGifts.map((gift) => gift.id)) : [],
    includeGreeting: "invitationGreeting" in patch,
    coverIsUpload: isHostUploadImageUrl,
    imageIsUpload: isHostUploadImageUrl,
    newGiftId: () => randomUUID(),
  });
  if (!planned.ok) {
    throw new Error(planned.error);
  }
  await writeEventEdit(eventId, planned.plan, current.gifts);
  return { slug: current.slug };
}

async function writeEventEdit(
  eventId: string,
  plan: EventEditPlan,
  currentGifts: EventEditGift[],
) {
  const supabase = getSupabaseServiceClient();
  const details = plan.details;
  const eventPatch: Record<string, string> = {
    title: details.title,
    host_name: details.hostName,
    event_type: details.eventType,
    event_date: details.date,
    event_time: details.time,
    venue_name: details.venueName,
    address: details.address,
    message: details.message,
    cover_image: details.coverImage,
  };
  if (details.invitationGreeting != null) {
    eventPatch.invitation_greeting = details.invitationGreeting;
  }
  const saved = await supabase.from("events").update(eventPatch).eq("id", eventId).select("id");
  throwIfWriteError(saved.error);
  if (!saved.data?.length) {
    throw new Error("שמירת האירוע נכשלה.");
  }

  if (!plan.gifts) {
    return;
  }

  const previousStore = new Map(currentGifts.map((gift) => [gift.id, gift.storeId]));
  const changedStoreIds = [
    ...new Set(
      plan.gifts
        .filter((gift) => Boolean(gift.storeId) && previousStore.get(gift.id) !== gift.storeId)
        .map((gift) => gift.storeId as string),
    ),
  ];
  const names = await storeNames(changedStoreIds);
  for (const gift of plan.gifts) {
    if (!gift.storeId || previousStore.get(gift.id) === gift.storeId) {
      continue;
    }
    if (!names.get(gift.storeId)) {
      throw new Error("החנות שנבחרה אינה פעילה.");
    }
  }

  for (const id of plan.removeIds) {
    const removed = await supabase
      .from("event_gifts")
      .delete()
      .eq("id", id)
      .eq("event_id", eventId)
      .select("id");
    throwIfWriteError(removed.error);
  }

  for (const gift of plan.gifts) {
    const keepStore = Boolean(gift.storeId) && previousStore.get(gift.id) === gift.storeId;
    const row: Record<string, unknown> = {
      title: gift.title,
      description: gift.description,
      target_amount: gift.targetAmount,
      icon: gift.icon,
      image_url: gift.imageUrl,
      priority: gift.priority,
      active: gift.active,
    };
    if (!keepStore) {
      row.store_id = gift.storeId;
      row.store_name = gift.storeId ? (names.get(gift.storeId) ?? "").slice(0, 120) : "";
    }
    if (gift.isNew) {
      const inserted = await supabase.from("event_gifts").insert({
        id: gift.id,
        event_id: eventId,
        source: "custom",
        ...row,
      });
      throwIfWriteError(inserted.error);
      continue;
    }
    const updated = await supabase
      .from("event_gifts")
      .update(row)
      .eq("id", gift.id)
      .eq("event_id", eventId)
      .select("id");
    throwIfWriteError(updated.error);
    if (!updated.data?.length) {
      throw new Error("המתנה לא נמצאה.");
    }
  }
}
