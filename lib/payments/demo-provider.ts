import "server-only";
import { markOrderFailed, markOrderPaid } from "@/lib/orders/repository";
import type { StoredOrder } from "@/lib/orders/types";
import type { PaymentOutcome } from "./types";
import { createDemoPaymentReference } from "./reference";

export const DEMO_PROVIDER_NAME = "demo";

function payableStatus(order: StoredOrder) {
  if (order.paymentStatus === "cancelled") {
    throw new Error("ההזמנה בוטלה.");
  }
  if (order.paymentStatus === "paid") {
    return "paid" as const;
  }
  return "ready" as const;
}

export const demoPaymentProvider = {
  name: DEMO_PROVIDER_NAME,
  isDemo: true as const,
  async startPayment(order: StoredOrder) {
    return { status: payableStatus(order) };
  },
  async confirmDemoPayment(input: {
    orderId: string;
    accessToken: string;
    outcome: PaymentOutcome;
  }) {
    if (input.outcome === "failure") {
      return markOrderFailed(input.orderId, input.accessToken, DEMO_PROVIDER_NAME);
    }

    return markOrderPaid(input.orderId, input.accessToken, {
      provider: DEMO_PROVIDER_NAME,
      paymentReference: createDemoPaymentReference(),
      paidAt: new Date().toISOString(),
    });
  },
};
