import "server-only";
import type { StoredOrder } from "@/lib/orders/types";
import { SERVICE_UNAVAILABLE_MESSAGE } from "@/lib/security/required-secret";
import { demoPaymentProvider } from "./demo-provider";
import { resolveProviderKind } from "./selection";
import type { PaymentOutcome } from "./types";

/**
 * Server-side payment boundary.
 *
 * startPayment prepares checkout and must not mark an order paid.
 * Only the demo provider confirms from the guest's browser, and only after
 * the order access token is checked. It never collects a card number.
 *
 * A live Israeli provider plugs in later as another implementation:
 * 1. Add a provider object with startPayment that returns a checkoutUrl.
 * 2. Register its name below.
 * 3. Add a webhook route that verifies the provider's signature and then
 *    calls markOrderPaid. Do not trust a browser call for live capture.
 * 4. Set PAYMENT_PROVIDER to that name.
 *
 * Until a live provider is configured, demo is active. That needs no new
 * env var on Vercel. PAYMENT_PROVIDER=none keeps orders pending.
 * An unknown name refuses to run, so it cannot be mistaken for demo or for
 * real money.
 */

export type ProviderStart = {
  status: "ready" | "paid" | "unavailable";
  checkoutUrl?: string;
};

export type PaymentProvider = {
  name: string;
  isDemo: boolean;
  startPayment: (order: StoredOrder) => Promise<ProviderStart>;
  confirmDemoPayment?: (input: {
    orderId: string;
    accessToken: string;
    outcome: PaymentOutcome;
  }) => Promise<StoredOrder>;
};

const nonePaymentProvider: PaymentProvider = {
  name: "none",
  isDemo: false,
  async startPayment(order) {
    if (order.paymentStatus === "paid") {
      return { status: "paid" };
    }
    return { status: "unavailable" };
  },
};

export function getPaymentProvider(): PaymentProvider {
  const kind = resolveProviderKind(process.env.PAYMENT_PROVIDER);
  if (kind === "demo") {
    return demoPaymentProvider;
  }
  if (kind === "none") {
    return nonePaymentProvider;
  }

  console.error(
    "[LOLO] PAYMENT_PROVIDER is set, but that live provider is not implemented yet.",
    { provider: process.env.PAYMENT_PROVIDER?.trim().toLowerCase() },
  );
  const unavailable = new Error(SERVICE_UNAVAILABLE_MESSAGE);
  unavailable.name = "ServiceUnavailableError";
  throw unavailable;
}

export function getDemoPaymentProvider() {
  const provider = getPaymentProvider();
  if (!provider.isDemo || !provider.confirmDemoPayment) {
    return null;
  }
  return provider;
}
