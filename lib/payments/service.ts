import "server-only";
import { roundMoney } from "@/lib/money";
import {
  cancelUnpaidOrder,
  getOrderById,
  getOrderForGuest,
  markOrderFailed,
  markOrderFailedFromVerifiedEvent,
  markOrderPaid,
  markOrderPaidFromVerifiedEvent,
} from "@/lib/orders/repository";
import type { StoredOrder } from "@/lib/orders/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { cancelVoucher } from "@/lib/vouchers/repository";
import { planVoucherRefundRelease, refundCoversRemainder } from "@/lib/vouchers/refund-release";
import { performDemoRefund, type DemoRefundRecord } from "./demo-refund";
import { DEMO_PROVIDER_NAME } from "./demo-provider-name";
import {
  attachRefundSummary,
  findRefund,
  insertRefund,
  loadRefundVoucherSlices,
  recordAttempt,
  recordSucceededCapture,
  sumRecordedRefunds,
} from "./ledger";
import {
  CANCEL_PAID_REFUSED,
  ORDER_CANCELLED,
  PaymentsNotEnabledError,
  REFUND_DEMO_ONLY,
  rethrowIfPaymentsSchema,
} from "./messages";
import type { RefundActor, RefundPolicy } from "./refund-policy";
import { createDemoPaymentReference } from "./reference";
import type { DemoPaymentEvent } from "./events";
import type { PaymentOutcome } from "./types";

function createDemoRefundReference() {
  return `demo-refund-${createDemoPaymentReference().slice("demo-".length)}`;
}

export async function readRefundPolicy(): Promise<RefundPolicy> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select(
      "refund_window_days, refund_approver, refund_allow_partial, refund_blocks_issued_voucher",
    )
    .eq("id", "default")
    .maybeSingle();
  if (error) {
    rethrowIfPaymentsSchema(error);
    console.error("[LOLO] refund policy read failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error("לא ניתן לקרוא את מדיניות ההחזרים.");
  }
  const row = data as {
    refund_window_days?: number | string | null;
    refund_approver?: string | null;
    refund_allow_partial?: boolean | null;
    refund_blocks_issued_voucher?: boolean | null;
  } | null;
  const approver = row?.refund_approver;
  return {
    windowDays: row?.refund_window_days == null ? null : Number(row.refund_window_days),
    approver:
      approver === "admin" || approver === "guest" || approver === "none" ? approver : null,
    allowPartial: row?.refund_allow_partial ?? null,
    blocksIssuedVoucher: row?.refund_blocks_issued_voucher ?? null,
  };
}

export async function startDemoCheckout(order: StoredOrder, idempotencyKey: string) {
  if (order.paymentStatus === "cancelled") {
    throw new Error(ORDER_CANCELLED);
  }
  if (order.paymentStatus === "paid") {
    return { status: "paid" as const, replayed: true };
  }
  const recorded = await recordAttempt({
    orderId: order.id,
    idempotencyKey,
    providerReference: null,
    providerEventId: null,
    kind: "start",
    status: "started",
    amount: order.chargedAmount,
    paidAt: null,
  });
  return { status: "ready" as const, replayed: recorded.replayed };
}

export async function confirmDemoCheckout(input: {
  orderId: string;
  accessToken: string;
  outcome: PaymentOutcome;
  idempotencyKey: string;
}) {
  const current = await getOrderForGuest(input.orderId, input.accessToken);
  if (!current) {
    throw new Error("ההזמנה לא נמצאה.");
  }
  if (current.paymentStatus === "cancelled") {
    throw new Error(ORDER_CANCELLED);
  }
  if (input.outcome === "failure") {
    if (current.paymentStatus === "paid") {
      return current;
    }
    await recordAttempt({
      orderId: current.id,
      idempotencyKey: input.idempotencyKey,
      providerReference: null,
      providerEventId: null,
      kind: "confirm",
      status: "failed",
      amount: current.chargedAmount,
      paidAt: null,
    });
    return markOrderFailed(input.orderId, input.accessToken, DEMO_PROVIDER_NAME);
  }
  if (current.paymentStatus === "paid") {
    return current;
  }

  const paidAt = new Date().toISOString();
  const recorded = await recordSucceededCapture({
    orderId: current.id,
    idempotencyKey: input.idempotencyKey,
    providerEventId: null,
    kind: "confirm",
    amount: current.chargedAmount,
    paidAt,
  });
  if (!recorded.attempt.providerReference || !recorded.attempt.paidAt) {
    throw new Error("אישור התשלום נכשל.");
  }
  return markOrderPaid(input.orderId, input.accessToken, {
    provider: DEMO_PROVIDER_NAME,
    paymentReference: recorded.attempt.providerReference,
    paidAt: recorded.attempt.paidAt,
  });
}

export async function applyDemoWebhook(event: DemoPaymentEvent) {
  const order = await getOrderById(event.orderId);
  if (!order) {
    throw new Error("ההזמנה לא נמצאה.");
  }
  if (event.provider !== DEMO_PROVIDER_NAME) {
    throw new PaymentsNotEnabledError();
  }
  if (roundMoney(event.amount) !== roundMoney(order.chargedAmount)) {
    throw new Error("סכום עדכון התשלום אינו תואם להזמנה.");
  }
  const idempotencyKey = event.eventId;
  if (event.type === "payment.failed") {
    const recorded = await recordAttempt({
      orderId: order.id,
      idempotencyKey,
      providerReference: null,
      providerEventId: event.eventId,
      kind: "webhook",
      status: "failed",
      amount: order.chargedAmount,
      paidAt: null,
    });
    if (order.paymentStatus === "paid" || order.paymentStatus === "cancelled") {
      return { replayed: recorded.replayed, paidAt: order.paidAt };
    }
    await markOrderFailedFromVerifiedEvent(order.id, DEMO_PROVIDER_NAME);
    return { replayed: recorded.replayed, paidAt: null };
  }

  if (order.paymentStatus === "cancelled") {
    throw new Error(ORDER_CANCELLED);
  }
  const paidAt = order.paidAt ?? new Date().toISOString();
  const existingReference = order.paymentReference?.trim().toLowerCase() ?? "";
  const recorded = await recordSucceededCapture({
    orderId: order.id,
    idempotencyKey,
    providerEventId: event.eventId,
    kind: "webhook",
    amount: order.chargedAmount,
    paidAt,
    providerReference:
      order.paymentStatus === "paid" && existingReference.startsWith("demo-")
        ? existingReference
        : undefined,
  });
  if (!recorded.attempt.providerReference || !recorded.attempt.paidAt) {
    throw new Error("אישור התשלום נכשל.");
  }
  if (order.paymentStatus === "paid") {
    return { replayed: recorded.replayed, paidAt: order.paidAt };
  }
  const paid = await markOrderPaidFromVerifiedEvent(order.id, {
    provider: DEMO_PROVIDER_NAME,
    paymentReference: recorded.attempt.providerReference,
    paidAt: recorded.attempt.paidAt,
  });
  return { replayed: recorded.replayed, paidAt: paid.paidAt };
}

export async function cancelDemoOrder(orderId: string, accessToken: string, idempotencyKey: string) {
  const current = await getOrderForGuest(orderId, accessToken);
  if (!current) {
    throw new Error("ההזמנה לא נמצאה.");
  }
  if (current.paymentStatus === "cancelled") {
    return current;
  }
  if (current.paymentStatus === "paid") {
    throw new Error(CANCEL_PAID_REFUSED);
  }
  await recordAttempt({
    orderId: current.id,
    idempotencyKey,
    providerReference: null,
    providerEventId: null,
    kind: "cancel",
    status: "cancelled",
    amount: current.chargedAmount,
    paidAt: null,
  });
  return cancelUnpaidOrder(orderId, accessToken);
}

export async function refundDemoOrder(input: {
  orderId: string;
  accessToken: string | null;
  actor: RefundActor;
  amount: number;
  idempotencyKey: string;
  reason: string;
}): Promise<DemoRefundRecord> {
  const order =
    input.actor === "guest"
      ? await getOrderForGuest(input.orderId, input.accessToken ?? "")
      : await getOrderById(input.orderId);
  if (!order) {
    throw new Error("ההזמנה לא נמצאה.");
  }
  if ((order.paymentProvider ?? "").trim().toLowerCase() !== DEMO_PROVIDER_NAME) {
    throw new Error(REFUND_DEMO_ONLY);
  }
  const policy = await readRefundPolicy();
  const alreadyRefunded = await sumRecordedRefunds(order.id);
  const slices = await loadRefundVoucherSlices(order.items.map((item) => item.giftId));
  const release = planVoucherRefundRelease({
    policyBlocksRedemptions: policy.blocksIssuedVoucher === true,
    fullRefund: refundCoversRemainder(order.chargedAmount, alreadyRefunded, input.amount),
    vouchers: slices,
  });
  const existing = await findRefund(order.id, input.idempotencyKey);
  const planned = performDemoRefund({
    orderId: order.id,
    actor: input.actor,
    amount: input.amount,
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
    now: new Date().toISOString(),
    policy,
    paymentStatus: order.paymentStatus,
    paymentProvider: order.paymentProvider,
    paymentReference: order.paymentReference,
    paidAt: order.paidAt,
    chargedAmount: order.chargedAmount,
    alreadyRefunded,
    redeemedVoucher: release.block,
    existing,
    createReference: createDemoRefundReference,
  });
  if (planned.replayed) {
    return planned;
  }
  for (const voucherId of release.cancelIds) {
    await cancelVoucher(voucherId);
  }
  const saved = await insertRefund(planned);
  return { ...saved, replayed: false };
}

export async function presentOrder(order: StoredOrder) {
  return attachRefundSummary(order);
}
