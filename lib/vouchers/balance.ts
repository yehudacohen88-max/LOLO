import { roundMoney } from "@/lib/money";
import { asVoucherStatus, effectiveVoucherStatus } from "@/lib/vouchers/status";
import type { VoucherBalanceReadModel, VoucherRedemptionView } from "@/lib/vouchers/types";

export type { VoucherBalanceReadModel };

export function buildVoucherBalance(input: {
  voucherId: string;
  amount: number;
  remainingAmount: number;
  status: string;
  expiresAt: string;
  now?: number;
  redemptions: VoucherRedemptionView[];
}): VoucherBalanceReadModel {
  const redemptions = [...input.redemptions].sort((left, right) =>
    left.redeemedAt.localeCompare(right.redeemedAt),
  );
  return {
    voucherId: input.voucherId,
    amount: roundMoney(input.amount),
    remainingAmount: roundMoney(input.remainingAmount),
    status: effectiveVoucherStatus(
      asVoucherStatus(input.status),
      input.expiresAt,
      input.now ?? Date.now(),
    ),
    expiresAt: input.expiresAt,
    redemptions,
  };
}
