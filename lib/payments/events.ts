import { isUuid } from "@/lib/orders/guest-input";
import { WEBHOOK_BAD_PAYLOAD, PAYMENTS_LIVE_NOT_ENABLED, DEMO_CANNOT_BE_REAL_MONEY } from "./messages";

export type DemoPaymentEvent = {
  eventId: string;
  type: "payment.succeeded" | "payment.failed";
  provider: "demo";
  orderId: string;
  amount: number;
};

const EVENT_ID = /^[A-Za-z0-9:_-]{8,80}$/;

export function buildDemoWebhookBody(event: DemoPaymentEvent) {
  return JSON.stringify({
    id: event.eventId,
    type: event.type,
    provider: event.provider,
    orderId: event.orderId,
    amount: event.amount,
  });
}

export function parseDemoWebhook(rawBody: string): DemoPaymentEvent {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error(WEBHOOK_BAD_PAYLOAD);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(WEBHOOK_BAD_PAYLOAD);
  }
  const body = payload as Record<string, unknown>;
  const provider = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
  if (provider !== "demo") {
    throw new Error(PAYMENTS_LIVE_NOT_ENABLED);
  }
  if (body.providerReference != null || body.paymentReference != null) {
    const reference = String(body.providerReference ?? body.paymentReference).trim().toLowerCase();
    if (!reference.startsWith("demo-")) {
      throw new Error(DEMO_CANNOT_BE_REAL_MONEY);
    }
  }
  const eventId = typeof body.id === "string" ? body.id.trim() : "";
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const type = body.type;
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!EVENT_ID.test(eventId) || !isUuid(orderId)) {
    throw new Error(WEBHOOK_BAD_PAYLOAD);
  }
  if (type !== "payment.succeeded" && type !== "payment.failed") {
    throw new Error(WEBHOOK_BAD_PAYLOAD);
  }
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(WEBHOOK_BAD_PAYLOAD);
  }
  return {
    eventId,
    type,
    provider: "demo",
    orderId,
    amount,
  };
}
