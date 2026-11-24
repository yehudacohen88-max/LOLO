import { roundMoney } from "@/lib/money";
import {
  REFUND_AMOUNT_INVALID,
  REFUND_DISABLED,
  REFUND_FORBIDDEN,
  REFUND_FULL_ONLY,
  REFUND_POLICY_NOT_CONFIGURED,
  REFUND_VOUCHER_BLOCKED,
  REFUND_WINDOW_CLOSED,
} from "./messages";

export type RefundApprover = "admin" | "guest" | "none";

export type RefundActor = "admin" | "guest";

/**
 * All four fields come from platform_settings. Null means the founder has not
 * chosen a policy yet. This module does not fill in a window, an approver, or
 * a voucher rule.
 */
export type RefundPolicy = {
  windowDays: number | null;
  approver: RefundApprover | null;
  allowPartial: boolean | null;
  blocksIssuedVoucher: boolean | null;
};

export type RefundPolicySnapshot = {
  windowDays: number;
  approver: RefundApprover;
  allowPartial: boolean;
  blocksIssuedVoucher: boolean;
};

export type RefundDecision =
  | { ok: true; snapshot: RefundPolicySnapshot; amount: number }
  | { ok: false; message: string };

const DAY_MS = 24 * 60 * 60 * 1000;

function configured(policy: RefundPolicy): policy is {
  windowDays: number;
  approver: RefundApprover;
  allowPartial: boolean;
  blocksIssuedVoucher: boolean;
} {
  return (
    typeof policy.windowDays === "number" &&
    Number.isInteger(policy.windowDays) &&
    policy.windowDays >= 0 &&
    (policy.approver === "admin" || policy.approver === "guest" || policy.approver === "none") &&
    typeof policy.allowPartial === "boolean" &&
    typeof policy.blocksIssuedVoucher === "boolean"
  );
}

export function decideRefund(input: {
  policy: RefundPolicy;
  actor: RefundActor;
  paidAt: string | null;
  now: string;
  chargedAmount: number;
  alreadyRefunded: number;
  requestedAmount: number;
  issuedVoucher: boolean;
  paymentStatus: string;
}): RefundDecision {
  if (!configured(input.policy)) {
    return { ok: false, message: REFUND_POLICY_NOT_CONFIGURED };
  }
  if (input.policy.approver === "none") {
    return { ok: false, message: REFUND_DISABLED };
  }
  if (input.actor !== input.policy.approver) {
    return { ok: false, message: REFUND_FORBIDDEN };
  }
  if (input.paymentStatus !== "paid") {
    return { ok: false, message: "אפשר להחזיר רק הזמנה ששולמה." };
  }
  const paidAtMs = input.paidAt ? Date.parse(input.paidAt) : Number.NaN;
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(paidAtMs) || !Number.isFinite(nowMs)) {
    return { ok: false, message: "תאריך התשלום אינו תקין." };
  }
  if (nowMs > paidAtMs + input.policy.windowDays * DAY_MS) {
    return { ok: false, message: REFUND_WINDOW_CLOSED };
  }
  if (input.policy.blocksIssuedVoucher && input.issuedVoucher) {
    return { ok: false, message: REFUND_VOUCHER_BLOCKED };
  }

  const charged = roundMoney(input.chargedAmount);
  const already = roundMoney(input.alreadyRefunded);
  const remaining = roundMoney(charged - already);
  const requested = roundMoney(input.requestedAmount);
  if (!(requested > 0) || !(remaining > 0) || requested - remaining > 0) {
    return { ok: false, message: REFUND_AMOUNT_INVALID };
  }
  if (!input.policy.allowPartial && requested !== remaining) {
    return { ok: false, message: REFUND_FULL_ONLY };
  }
  return {
    ok: true,
    amount: requested,
    snapshot: {
      windowDays: input.policy.windowDays,
      approver: input.policy.approver,
      allowPartial: input.policy.allowPartial,
      blocksIssuedVoucher: input.policy.blocksIssuedVoucher,
    },
  };
}
