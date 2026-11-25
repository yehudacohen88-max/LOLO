import "server-only";
import type { StoredOrder } from "@/lib/orders/types";
import { verifyWebhookSignature } from "./webhook-signature";
import { parseDemoWebhook } from "./events";
import { refuseNonDemoRefund } from "./live-stub";
import type { PaymentProvider } from "./contract";
import { DEMO_PROVIDER_NAME } from "./demo-provider-name";
import {
  confirmDemoCheckout,
  refundDemoOrder,
  startDemoCheckout,
} from "./service";

export { DEMO_PROVIDER_NAME } from "./demo-provider-name";

export const demoPaymentProvider: PaymentProvider = {
  name: DEMO_PROVIDER_NAME,
  isDemo: true,
  async start(input) {
    const started = await startDemoCheckout(input.order, input.idempotencyKey);
    return { status: started.status, replayed: started.replayed };
  },
  async confirm(input) {
    return confirmDemoCheckout(input);
  },
  async refund(input) {
    return refundDemoOrder(input);
  },
  verifyWebhook(input) {
    return verifyWebhookSignature(input);
  },
  parseEvent(rawBody) {
    return parseDemoWebhook(rawBody);
  },
};

export const nonePaymentProvider: PaymentProvider = {
  name: "none",
  isDemo: false,
  async start(input: { order: StoredOrder }) {
    if (input.order.paymentStatus === "paid") {
      return { status: "paid", replayed: false };
    }
    return { status: "unavailable", replayed: false };
  },
  async confirm() {
    throw new Error("אישור התשלום אינו זמין באמצעי התשלום הנוכחי.");
  },
  async refund() {
    refuseNonDemoRefund();
  },
  verifyWebhook() {
    return { ok: false };
  },
  parseEvent() {
    throw new Error("אישור התשלום אינו זמין באמצעי התשלום הנוכחי.");
  },
};
