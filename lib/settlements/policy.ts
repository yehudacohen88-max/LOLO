import { roundMoney } from "@/lib/money";
import { assertSettlementRounding, roundingIsConfigured } from "@/lib/settlements/rounding";

/** Matches the settlement_lines check already in supabase/settlements.sql. */
export const MAX_PAYMENT_TERMS_DAYS = 3650;

export type SettlementPolicy = {
  rounding: string | null;
  fallbackCommissionPercent: number | null;
  fallbackPaymentTermsDays: number | null;
};

export const EMPTY_SETTLEMENT_POLICY: SettlementPolicy = {
  rounding: null,
  fallbackCommissionPercent: null,
  fallbackPaymentTermsDays: null,
};

export type ResolvedCommission = {
  percent: number;
  specified: boolean;
};

export type ResolvedTerms = {
  days: number;
  specified: boolean;
};

function percentInRange(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export function resolveCommissionPercent(
  snapshot: number | null,
  policy: SettlementPolicy,
): ResolvedCommission {
  assertSettlementRounding(policy.rounding);
  if (snapshot != null && Number.isFinite(snapshot)) {
    const percent = roundMoney(snapshot);
    if (!percentInRange(percent)) {
      throw new Error("settlement_amount_invalid");
    }
    return { percent, specified: true };
  }
  if (
    policy.fallbackCommissionPercent != null &&
    Number.isFinite(policy.fallbackCommissionPercent)
  ) {
    const percent = roundMoney(policy.fallbackCommissionPercent);
    if (!percentInRange(percent)) {
      throw new Error("settlement_amount_invalid");
    }
    return { percent, specified: false };
  }
  throw new Error("settlement_commission_unspecified");
}

export function tryResolveCommissionPercent(
  snapshot: number | null,
  policy: SettlementPolicy,
): ResolvedCommission | null {
  if (!roundingIsConfigured(policy.rounding)) {
    return null;
  }
  try {
    return resolveCommissionPercent(snapshot, policy);
  } catch {
    return null;
  }
}

export function resolvePaymentTermsDays(
  snapshot: number | null,
  policy: SettlementPolicy,
): ResolvedTerms {
  if (snapshot != null) {
    if (!Number.isInteger(snapshot) || snapshot < 0 || snapshot > MAX_PAYMENT_TERMS_DAYS) {
      throw new Error("settlement_terms_invalid");
    }
    return { days: snapshot, specified: true };
  }
  const fallback = policy.fallbackPaymentTermsDays;
  if (fallback == null) {
    throw new Error("settlement_terms_unspecified");
  }
  if (!Number.isInteger(fallback) || fallback < 0 || fallback > MAX_PAYMENT_TERMS_DAYS) {
    throw new Error("settlement_terms_invalid");
  }
  return { days: fallback, specified: false };
}

export function tryResolvePaymentTermsDays(
  snapshot: number | null,
  policy: SettlementPolicy,
): ResolvedTerms | null {
  try {
    return resolvePaymentTermsDays(snapshot, policy);
  } catch {
    return null;
  }
}
