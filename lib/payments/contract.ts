import type { StoredOrder } from "@/lib/orders/types";
import type { DemoPaymentEvent } from "./events";
import type { DemoRefundRecord } from "./demo-refund";
import type { PaymentOutcome } from "./types";
import type { RefundActor } from "./refund-policy";

export type WebhookCheck = { ok: true } | { ok: false };

export type ProviderStartResult = {
  status: "ready" | "paid" | "unavailable";
  checkoutUrl?: string;
  replayed: boolean;
};

/**
 * Swappable payment boundary.
 * start prepares checkout and must not mark an order paid.
 * confirm is the demo browser capture. Live capture belongs to a verified webhook.
 * refund records a demo refund and must not call a live PSP.
 * verifyWebhook checks the signature only. parseEvent reads a verified body.
 */
export type PaymentProvider = {
  name: string;
  isDemo: boolean;
  start(input: { order: StoredOrder; idempotencyKey: string }): Promise<ProviderStartResult>;
  confirm(input: {
    orderId: string;
    accessToken: string;
    outcome: PaymentOutcome;
    idempotencyKey: string;
  }): Promise<StoredOrder>;
  refund(input: {
    orderId: string;
    accessToken: string | null;
    actor: RefundActor;
    amount: number;
    idempotencyKey: string;
    reason: string;
  }): Promise<DemoRefundRecord>;
  verifyWebhook(input: {
    rawBody: string;
    signature: string | null;
    secret: string;
  }): WebhookCheck;
  parseEvent(rawBody: string): DemoPaymentEvent;
};
