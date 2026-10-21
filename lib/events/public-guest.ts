import type { EventFunding } from "@/lib/funding/calculate";
import type { EventGift, StoredEvent } from "@/lib/events/types";
import type { StoredOrder, StoredOrderItem } from "@/lib/orders/types";

export const PUBLIC_GIFT_KEYS = [
  "id",
  "eventId",
  "title",
  "description",
  "targetAmount",
  "icon",
  "imageUrl",
  "source",
  "priority",
  "active",
  "storeId",
  "storeName",
] as const;

export const PUBLIC_FUNDING_GIFT_KEYS = [
  "giftId",
  "raisedAmount",
  "contributorCount",
  "percentOfTarget",
] as const;

export const PUBLIC_ORDER_KEYS = [
  "id",
  "eventId",
  "eventSlug",
  "guestName",
  "totalAmount",
  "contributionAmount",
  "feeAmount",
  "chargedAmount",
  "paymentStatus",
  "paymentProvider",
  "paymentReference",
  "paidAt",
  "accessToken",
  "items",
] as const;

export const PUBLIC_ORDER_ITEM_KEYS = ["giftId", "giftName", "amount"] as const;

export const PUBLIC_QUOTE_KEYS = [
  "contributionAmount",
  "feeAmount",
  "chargedAmount",
  "feeEnabled",
  "provider",
  "isDemo",
] as const;

export const PUBLIC_INVITE_KEYS = ["name", "phone"] as const;

const FORBIDDEN_PUBLIC_KEYS = new Set([
  "accessCode",
  "access_code",
  "codeHash",
  "code_hash",
  "guestPhone",
  "guest_phone",
  "guestEmail",
  "guest_email",
  "greetingText",
  "greeting_text",
  "hostSession",
  "password",
]);

function publicSource(source: string): EventGift["source"] {
  return source === "custom" || source === "catalog" ? source : "";
}

function publicGift(gift: EventGift): EventGift {
  return {
    id: gift.id,
    eventId: gift.eventId,
    title: gift.title,
    description: gift.description,
    targetAmount: gift.targetAmount,
    icon: gift.icon,
    imageUrl: gift.imageUrl,
    source: publicSource(gift.source),
    priority: gift.priority,
    active: gift.active,
    storeId: null,
    storeName: gift.storeName,
  };
}

export function toPublicGuestEvent(event: StoredEvent): StoredEvent {
  return {
    id: event.id,
    slug: event.slug,
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
    gifts: event.gifts.map(publicGift),
    createdAt: event.createdAt,
  };
}

export function toPublicFunding(funding: EventFunding) {
  return {
    gifts: funding.gifts.map((gift) => ({
      giftId: gift.giftId,
      raisedAmount: gift.raisedAmount,
      contributorCount: gift.contributorCount,
      percentOfTarget: gift.percentOfTarget,
    })),
  };
}

function publicItem(item: StoredOrderItem): StoredOrderItem {
  return {
    giftId: item.giftId,
    giftName: item.giftName,
    amount: item.amount,
  };
}

/** The caller's own order. The access token is the one they presented. */
export function toPublicOrder(order: StoredOrder): StoredOrder {
  return {
    id: order.id,
    eventId: order.eventId,
    eventSlug: order.eventSlug,
    guestName: order.guestName,
    totalAmount: order.totalAmount,
    contributionAmount: order.contributionAmount,
    feeAmount: order.feeAmount,
    chargedAmount: order.chargedAmount,
    paymentStatus: order.paymentStatus,
    paymentProvider: order.paymentProvider,
    paymentReference: order.paymentReference,
    paidAt: order.paidAt,
    accessToken: order.accessToken,
    items: order.items.map(publicItem),
  };
}

export function toPublicQuote(input: {
  contributionAmount: number;
  feeAmount: number;
  chargedAmount: number;
  feeEnabled: boolean;
  provider: string;
  isDemo: boolean;
}) {
  return {
    contributionAmount: input.contributionAmount,
    feeAmount: input.feeAmount,
    chargedAmount: input.chargedAmount,
    feeEnabled: input.feeEnabled,
    provider: input.provider,
    isDemo: input.isDemo,
  };
}

export function toPublicPaymentStart(input: {
  provider: string;
  isDemo: boolean;
  orderId: string;
  status: "ready" | "paid" | "unavailable";
  checkoutUrl?: string;
  contributionAmount: number;
  feeAmount: number;
  chargedAmount: number;
}) {
  const payload: {
    provider: string;
    isDemo: boolean;
    orderId: string;
    status: "ready" | "paid" | "unavailable";
    checkoutUrl?: string;
    contributionAmount: number;
    feeAmount: number;
    chargedAmount: number;
  } = {
    provider: input.provider,
    isDemo: input.isDemo,
    orderId: input.orderId,
    status: input.status,
    contributionAmount: input.contributionAmount,
    feeAmount: input.feeAmount,
    chargedAmount: input.chargedAmount,
  };
  if (input.checkoutUrl) {
    payload.checkoutUrl = input.checkoutUrl;
  }
  return payload;
}

export function toPublicInviteIdentity(input: { name?: unknown; phone?: unknown }) {
  return {
    name: typeof input.name === "string" ? input.name : "",
    phone: typeof input.phone === "string" ? input.phone : "",
  };
}

export function collectKeys(value: unknown, found: string[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, found);
    }
    return found;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      found.push(key);
      collectKeys(child, found);
    }
  }
  return found;
}

export function forbiddenPublicKeys(value: unknown) {
  return collectKeys(value).filter((key) => FORBIDDEN_PUBLIC_KEYS.has(key));
}
