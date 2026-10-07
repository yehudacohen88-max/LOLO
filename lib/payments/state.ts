import type { PaymentStatus } from "@/lib/orders/types";

export type PaymentSnapshot = {
  paymentStatus: PaymentStatus;
  paymentProvider: string | null;
  paymentReference: string | null;
  paidAt: string | null;
};

export type MarkPaidAttempt = {
  provider: string;
  paymentReference: string;
  paidAt: string;
};

export type MarkPaidDecision =
  | { action: "already_paid"; snapshot: PaymentSnapshot }
  | { action: "mark_paid"; snapshot: PaymentSnapshot }
  | { action: "reject" };

export type MarkFailedDecision =
  | { action: "already_paid"; snapshot: PaymentSnapshot }
  | { action: "already_failed"; snapshot: PaymentSnapshot }
  | { action: "mark_failed"; snapshot: PaymentSnapshot }
  | { action: "reject" };

/**
 * Paying is idempotent. A second success keeps the original reference and paid_at.
 * Pending and failed orders can become paid. Cancelled orders cannot.
 */
export function decideMarkPaid(
  current: PaymentSnapshot,
  attempt: MarkPaidAttempt,
): MarkPaidDecision {
  if (current.paymentStatus === "paid") {
    return { action: "already_paid", snapshot: current };
  }
  if (current.paymentStatus === "cancelled") {
    return { action: "reject" };
  }

  return {
    action: "mark_paid",
    snapshot: {
      paymentStatus: "paid",
      paymentProvider: attempt.provider,
      paymentReference: attempt.paymentReference,
      paidAt: attempt.paidAt,
    },
  };
}

/**
 * A simulated failure never undoes a paid order.
 * Repeating a failure leaves the failed order as it is.
 */
export function decideMarkFailed(
  current: PaymentSnapshot,
  provider: string,
): MarkFailedDecision {
  if (current.paymentStatus === "paid") {
    return { action: "already_paid", snapshot: current };
  }
  if (current.paymentStatus === "failed") {
    return { action: "already_failed", snapshot: current };
  }
  if (current.paymentStatus === "cancelled") {
    return { action: "reject" };
  }

  return {
    action: "mark_failed",
    snapshot: {
      paymentStatus: "failed",
      paymentProvider: provider,
      paymentReference: null,
      paidAt: null,
    },
  };
}
