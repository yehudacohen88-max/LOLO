import { roundMoney } from "@/lib/money";
import { assertSettlementRounding } from "@/lib/settlements/rounding";

/**
 * Shekels are stored at agora resolution (2 decimal places).
 *
 * Commission rounding follows platform_settings.money_rounding. The only
 * implemented rule is half_away_from_zero, the same rule as PostgreSQL
 * round(numeric, 2) and as supabase/settlements.sql:
 *   commission agorot = round(gross agorot * percent hundredths / 10000)
 * where percent hundredths is the percent times 100 (8% => 800, 8.33% => 833).
 * Payable agorot = gross agorot − commission agorot, so the two always sum to the gross.
 *
 * A missing commission percent is refused. Callers resolve a snapshotted
 * percent or an explicit platform_settings default before calling this.
 * A missing payment-terms value is also refused. The due instant is the
 * redemption time plus the resolved payment_terms_days × 24 hours.
 * Guest fees are not part of this split.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export type CommissionSplit = {
  grossAmount: number;
  commissionPercent: number;
  commissionSpecified: boolean;
  commissionAmount: number;
  payableAmount: number;
};

export function sumMoney(values: number[]) {
  const agorot = values.reduce((total, value) => total + Math.round(roundMoney(value) * 100), 0);
  return agorot / 100;
}

function percentHundredths(percent: number) {
  return Math.round(roundMoney(percent) * 100);
}

function roundRatioToAgorot(grossAgorot: number, hundredths: number) {
  const numerator = grossAgorot * hundredths;
  return Math.floor((numerator + 5000) / 10000);
}

export function splitCommission(
  gross: number,
  commissionPercent: number | null,
  rounding: string | null,
  commissionSpecified = true,
): CommissionSplit {
  assertSettlementRounding(rounding);
  const grossAmount = roundMoney(gross);
  const grossAgorot = Math.round(grossAmount * 100);
  if (!(grossAgorot > 0)) {
    throw new Error("settlement_amount_invalid");
  }

  if (commissionPercent == null || !Number.isFinite(commissionPercent)) {
    throw new Error("settlement_commission_unspecified");
  }
  const percent = roundMoney(commissionPercent);
  if (percent < 0 || percent > 100) {
    throw new Error("settlement_amount_invalid");
  }

  const commissionAgorot = roundRatioToAgorot(grossAgorot, percentHundredths(percent));
  const payableAgorot = grossAgorot - commissionAgorot;

  return {
    grossAmount,
    commissionPercent: percent,
    commissionSpecified,
    commissionAmount: commissionAgorot / 100,
    payableAmount: payableAgorot / 100,
  };
}

export function settlementDueAt(redeemedAt: string, paymentTermsDays: number | null) {
  if (paymentTermsDays == null || !Number.isInteger(paymentTermsDays)) {
    throw new Error(
      paymentTermsDays == null ? "settlement_terms_unspecified" : "settlement_terms_invalid",
    );
  }
  const days = paymentTermsDays;
  if (days < 0 || days > 3650) {
    throw new Error("settlement_terms_invalid");
  }
  const redeemed = new Date(redeemedAt).getTime();
  if (!Number.isFinite(redeemed)) {
    throw new Error("settlement_terms_invalid");
  }
  return new Date(redeemed + days * DAY_MS).toISOString();
}

export function earliestDueAt(values: string[]) {
  if (values.length === 0) {
    throw new Error("settlement_none");
  }
  return values.reduce((earliest, value) => (value < earliest ? value : earliest));
}

export function isSettlementOverdue(status: string, dueAt: string, now = Date.now()) {
  if (status !== "PENDING") {
    return false;
  }
  const due = new Date(dueAt).getTime();
  return Number.isFinite(due) && due < now;
}
