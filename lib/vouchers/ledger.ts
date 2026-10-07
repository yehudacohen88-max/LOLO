import { roundMoney } from "@/lib/money";
import {
  asVoucherStatus,
  effectiveVoucherStatus,
  voucherCanRedeem,
  type VoucherStatus,
} from "@/lib/vouchers/status";

export type IssuedVoucherSlice = {
  amount: number;
  status: string;
};

export type IssuePlan =
  | { ok: true; amount: number }
  | { ok: false; reason: "none" | "changed" };

export type LedgerVoucher = {
  id: string;
  amount: number;
  remaining: number;
  status: VoucherStatus;
  expiresAt: number;
  allowPartial: boolean;
  idempotencyKey: string;
};

export type RedeemPlan =
  | { ok: true; remaining: number; status: VoucherStatus }
  | { ok: false; reason: "expired" | "closed" | "partial" | "amount" };

let sequence = 0;

function nextId() {
  sequence += 1;
  return `voucher-${sequence}`;
}

export function resetLedgerIds() {
  sequence = 0;
}

/**
 * Mirrors voucher_committed_amount: cancelled vouchers release their amount.
 * Expired and redeemed vouchers keep the issued amount so it cannot be issued again.
 */
export function committedVoucherAmount(vouchers: IssuedVoucherSlice[]) {
  return roundMoney(
    vouchers.reduce((sum, voucher) => {
      if (voucher.status === "CANCELLED") {
        return sum;
      }
      return sum + roundMoney(voucher.amount);
    }, 0),
  );
}

export function availableToIssue(paidAmount: number, vouchers: IssuedVoucherSlice[]) {
  return roundMoney(
    Math.max(0, roundMoney(paidAmount) - committedVoucherAmount(vouchers)),
  );
}

export function planVoucherIssue(
  paidAmount: number,
  vouchers: IssuedVoucherSlice[],
  expectedAmount?: number | null,
): IssuePlan {
  const available = availableToIssue(paidAmount, vouchers);
  if (!(available > 0)) {
    return { ok: false, reason: "none" };
  }
  if (expectedAmount != null && roundMoney(expectedAmount) !== available) {
    return { ok: false, reason: "changed" };
  }
  return { ok: true, amount: available };
}

export function planVoucherRedeem(
  voucher: Pick<LedgerVoucher, "status" | "expiresAt" | "remaining" | "allowPartial">,
  amount: number | null,
  now: number,
): RedeemPlan {
  const status = effectiveVoucherStatus(voucher.status, voucher.expiresAt, now);
  if (status === "EXPIRED") {
    return { ok: false, reason: "expired" };
  }
  if (!voucherCanRedeem(status)) {
    return { ok: false, reason: "closed" };
  }

  const remaining = roundMoney(voucher.remaining);
  const requested = amount == null ? remaining : roundMoney(amount);
  if (!(requested > 0) || requested > remaining) {
    return { ok: false, reason: "amount" };
  }
  if (!voucher.allowPartial && requested !== remaining) {
    return { ok: false, reason: "partial" };
  }

  const nextRemaining = roundMoney(remaining - requested);
  return {
    ok: true,
    remaining: nextRemaining,
    status: nextRemaining === 0 ? "REDEEMED" : "PARTIALLY_REDEEMED",
  };
}

/**
 * In-memory stand-in for the per-gift advisory lock in issue_gift_voucher.
 * Parallel calls are serialized, then the same availability rule is applied.
 */
export class VoucherLedger {
  paid = 0;
  vouchers: LedgerVoucher[] = [];
  private chain: Promise<void> = Promise.resolve();

  setPaid(amount: number) {
    this.paid = roundMoney(amount);
  }

  issue(input: {
    idempotencyKey: string;
    expectedAmount?: number | null;
    allowPartial: boolean;
    expiresAt: number;
  }) {
    return this.exclusive(() => {
      const existing = this.vouchers.find(
        (voucher) => voucher.idempotencyKey === input.idempotencyKey,
      );
      if (existing) {
        return { ok: true as const, idempotent: true, voucher: existing };
      }

      const plan = planVoucherIssue(this.paid, this.vouchers, input.expectedAmount);
      if (!plan.ok) {
        return plan;
      }

      const voucher: LedgerVoucher = {
        id: nextId(),
        amount: plan.amount,
        remaining: plan.amount,
        status: "ISSUED",
        expiresAt: input.expiresAt,
        allowPartial: input.allowPartial,
        idempotencyKey: input.idempotencyKey,
      };
      this.vouchers.push(voucher);
      return { ok: true as const, idempotent: false, voucher };
    });
  }

  redeem(voucherId: string, amount: number | null, now: number) {
    return this.exclusive(() => {
      const voucher = this.vouchers.find((item) => item.id === voucherId);
      if (!voucher) {
        return { ok: false as const, reason: "closed" as const };
      }
      const plan = planVoucherRedeem(
        {
          ...voucher,
          status: asVoucherStatus(voucher.status),
        },
        amount,
        now,
      );
      if (!plan.ok) {
        return plan;
      }
      voucher.remaining = plan.remaining;
      voucher.status = plan.status;
      return { ok: true as const, voucher };
    });
  }

  private exclusive<T>(fn: () => T): Promise<T> {
    const run = this.chain.then(() => fn());
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
