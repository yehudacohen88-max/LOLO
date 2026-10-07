export const VOUCHER_STATUSES = [
  "ISSUED",
  "PARTIALLY_REDEEMED",
  "REDEEMED",
  "EXPIRED",
  "CANCELLED",
  "SETTLEMENT_PENDING",
  "SETTLED",
] as const;

export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

const OPEN_STATUSES = new Set<VoucherStatus>(["ISSUED", "PARTIALLY_REDEEMED"]);

export function asVoucherStatus(value: string): VoucherStatus {
  if (VOUCHER_STATUSES.includes(value as VoucherStatus)) {
    return value as VoucherStatus;
  }
  return "ISSUED";
}

export function effectiveVoucherStatus(
  status: VoucherStatus,
  expiresAt: string | number | Date,
  now = Date.now(),
): VoucherStatus {
  if (!OPEN_STATUSES.has(status)) {
    return status;
  }
  const expiry = new Date(expiresAt).getTime();
  if (Number.isFinite(expiry) && expiry <= now) {
    return "EXPIRED";
  }
  return status;
}

export function voucherCanRedeem(status: VoucherStatus) {
  return status === "ISSUED" || status === "PARTIALLY_REDEEMED";
}
