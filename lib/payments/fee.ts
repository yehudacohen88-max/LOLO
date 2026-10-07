import { roundMoney } from "@/lib/money";

export type GuestFeeSettings = {
  enabled: boolean;
  percent: number;
  fixedAmount: number;
};

export const GUEST_FEE_OFF: GuestFeeSettings = {
  enabled: false,
  percent: 0,
  fixedAmount: 0,
};

export type CheckoutAmounts = {
  contributionAmount: number;
  feeAmount: number;
  chargedAmount: number;
};

/**
 * Guest service fee is added on top of the gift contribution.
 * The contribution is what counts toward the gift. The fee never does.
 * When the fee is off, or both parts are 0, the charged total equals the contribution.
 */
export function calculateGuestFee(
  contribution: number,
  settings: GuestFeeSettings,
): CheckoutAmounts {
  const contributionAmount = roundMoney(Math.max(0, Number(contribution) || 0));
  if (!settings.enabled) {
    return {
      contributionAmount,
      feeAmount: 0,
      chargedAmount: contributionAmount,
    };
  }

  const percent = Math.min(100, Math.max(0, Number(settings.percent) || 0));
  const fixed = Math.max(0, Number(settings.fixedAmount) || 0);
  const contributionAgorot = Math.round(contributionAmount * 100);
  const percentAgorot = Math.round((contributionAgorot * percent) / 100);
  const fixedAgorot = Math.round(roundMoney(fixed) * 100);
  const feeAmount = roundMoney((percentAgorot + fixedAgorot) / 100);

  return {
    contributionAmount,
    feeAmount,
    chargedAmount: roundMoney(contributionAmount + feeAmount),
  };
}

/**
 * Legacy orders have no fee columns. Null fee means 0, and a null charged
 * total means the guest was charged the contribution only.
 */
export function orderMoneyFromRow(row: {
  total_amount?: number | string | null;
  fee_amount?: number | string | null;
  charged_amount?: number | string | null;
}): CheckoutAmounts {
  const contributionAmount = roundMoney(Number(row.total_amount) || 0);
  const feeMissing = row.fee_amount == null || row.fee_amount === "";
  const feeAmount = feeMissing ? 0 : roundMoney(Number(row.fee_amount) || 0);
  const chargedMissing = row.charged_amount == null || row.charged_amount === "";
  const chargedAmount = chargedMissing
    ? roundMoney(contributionAmount + feeAmount)
    : roundMoney(Number(row.charged_amount) || 0);

  return { contributionAmount, feeAmount, chargedAmount };
}
