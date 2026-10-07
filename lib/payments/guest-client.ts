import type { StoredOrder } from "@/lib/orders/types";
import type {
  CheckoutQuote,
  PaymentOutcome,
  StartPaymentResponse,
} from "./types";

async function readError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchCheckoutQuote(
  slug: string,
  items: { giftId: string; amount: number }[],
): Promise<CheckoutQuote> {
  const response = await fetch("/api/checkout/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, items }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "לא ניתן לחשב את הסכום לתשלום."));
  }
  return (await response.json()) as CheckoutQuote;
}

export async function startGuestCheckout(
  orderId: string,
  accessToken: string,
): Promise<StartPaymentResponse> {
  const response = await fetch("/api/payments/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, accessToken }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "לא ניתן להתחיל את התשלום."));
  }
  return (await response.json()) as StartPaymentResponse;
}

export async function confirmGuestCheckout(
  orderId: string,
  accessToken: string,
  outcome: PaymentOutcome,
): Promise<StoredOrder> {
  const response = await fetch("/api/payments/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, accessToken, outcome }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "אישור התשלום נכשל."));
  }
  return (await response.json()) as StoredOrder;
}
