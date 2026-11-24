import { IDEMPOTENCY_KEY_INVALID } from "./messages";

const KEY = /^[A-Za-z0-9:_-]{8,80}$/;

export type PaymentIdempotencyAction =
  | "start"
  | "confirm-success"
  | "confirm-failure"
  | "cancel"
  | "refund";

export function paymentIdempotencyKey(orderId: string, action: PaymentIdempotencyAction) {
  return readIdempotencyKey(`${action}:${orderId}`);
}

export function readIdempotencyKey(raw: unknown, fallback?: string) {
  const value = typeof raw === "string" && raw.trim() ? raw.trim() : (fallback ?? "");
  if (!KEY.test(value)) {
    throw new Error(IDEMPOTENCY_KEY_INVALID);
  }
  return value;
}
