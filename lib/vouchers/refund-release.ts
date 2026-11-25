import { roundMoney } from "@/lib/money";

export type RefundVoucherSlice = {
  id: string;
  status: string;
  amount: number;
  remainingAmount: number;
  redemptionCount: number;
};

export function refundCoversRemainder(
  chargedAmount: number,
  alreadyRefunded: number,
  requestedAmount: number,
) {
  const remaining = roundMoney(roundMoney(chargedAmount) - roundMoney(alreadyRefunded));
  return roundMoney(requestedAmount) === remaining && remaining > 0;
}

function hasRedemption(voucher: RefundVoucherSlice) {
  if (voucher.redemptionCount > 0) {
    return true;
  }
  if (voucher.status === "PARTIALLY_REDEEMED" || voucher.status === "REDEEMED") {
    return true;
  }
  if (voucher.status === "CANCELLED") {
    return false;
  }
  return roundMoney(voucher.remainingAmount) < roundMoney(voucher.amount);
}

function unredeemedOpen(voucher: RefundVoucherSlice) {
  if (hasRedemption(voucher)) {
    return false;
  }
  if (voucher.status !== "ISSUED") {
    return false;
  }
  return roundMoney(voucher.remainingAmount) === roundMoney(voucher.amount);
}

/**
 * The configured flag blocks a refund only when a voucher already has a
 * redemption. A full refund of an unredeemed voucher cancels that voucher
 * instead. A partial refund leaves it in place.
 */
export function planVoucherRefundRelease(input: {
  policyBlocksRedemptions: boolean;
  fullRefund: boolean;
  vouchers: RefundVoucherSlice[];
}): { block: boolean; cancelIds: string[] } {
  if (input.policyBlocksRedemptions && input.vouchers.some(hasRedemption)) {
    return { block: true, cancelIds: [] };
  }
  if (!input.fullRefund) {
    return { block: false, cancelIds: [] };
  }
  return {
    block: false,
    cancelIds: input.vouchers.filter(unredeemedOpen).map((voucher) => voucher.id),
  };
}
