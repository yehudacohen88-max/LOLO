import { DEMO_EVENT_SLUG } from "@/lib/events/demo";
import {
  loadContributions,
  loadGuestDetails,
  loadGuestGreeting,
} from "@/lib/guest-draft";
import { loadGuestOrderRef, saveGuestOrderRef } from "./guest-ref";
import type { StoredOrder } from "./types";

export async function savePendingGuestOrder(
  slug: string,
): Promise<StoredOrder | null> {
  if (!slug || slug === DEMO_EVENT_SLUG) {
    return null;
  }

  const details = loadGuestDetails(slug);
  const greeting = loadGuestGreeting(slug);
  const contributions = loadContributions(slug);
  const existing = loadGuestOrderRef(slug);

  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug,
      orderId: existing?.id,
      accessToken: existing?.accessToken,
      guestName: details.name,
      guestPhone: details.phone,
      guestEmail: details.email,
      wantsConfirmation: details.wantReceipt,
      greetingText: greeting.text,
      items: contributions.map((item) => ({
        giftId: item.giftId,
        amount: item.amount,
      })),
    }),
  });

  const payload = (await response.json()) as StoredOrder & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "שמירת ההזמנה נכשלה.");
  }

  saveGuestOrderRef(slug, {
    id: payload.id,
    accessToken: payload.accessToken,
  });

  return payload;
}

export async function loadPendingGuestOrder(
  slug: string,
): Promise<StoredOrder | null> {
  const existing = loadGuestOrderRef(slug);
  if (!existing || !slug || slug === DEMO_EVENT_SLUG) {
    return null;
  }

  const params = new URLSearchParams({
    id: existing.id,
    accessToken: existing.accessToken,
  });
  const response = await fetch(`/api/orders?${params.toString()}`);
  if (!response.ok) {
    return null;
  }

  return (await response.json()) as StoredOrder;
}
