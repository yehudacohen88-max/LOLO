import { roundMoney } from "@/lib/money";
import { MAX_PAYMENT_TERMS_DAYS, type SettlementPolicy } from "@/lib/settlements/policy";
import { SETTLEMENT_ROUNDING_RULE } from "@/lib/settlements/rounding";

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("הנתונים שנשלחו אינם תקינים.");
  }
  return value as Record<string, unknown>;
}

function optionalPercent(value: unknown) {
  if (value == null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("אחוז העמלה חייב להיות בין 0 ל־100, או ריק.");
  }
  return roundMoney(parsed);
}

function optionalDays(value: unknown) {
  if (value == null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_PAYMENT_TERMS_DAYS) {
    throw new Error("ימי התשלום אינם תקינים.");
  }
  return parsed;
}

export function parseSettlementPolicyInput(value: unknown): SettlementPolicy {
  const body = asRecord(value);
  let rounding: string | null = null;
  if (body.moneyRounding != null && body.moneyRounding !== "") {
    if (body.moneyRounding !== SETTLEMENT_ROUNDING_RULE) {
      throw new Error("כלל העיגול אינו מוכר.");
    }
    rounding = SETTLEMENT_ROUNDING_RULE;
  }
  return {
    rounding,
    fallbackCommissionPercent: optionalPercent(body.defaultCommissionPercent),
    fallbackPaymentTermsDays: optionalDays(body.defaultPaymentTermsDays),
  };
}
