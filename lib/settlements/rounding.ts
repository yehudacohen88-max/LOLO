/**
 * The only settlement rounding rule the app and SQL both implement.
 * PostgreSQL round(numeric, 2) is half away from zero. The TypeScript
 * agora split uses the same rule for positive amounts. Which rule is in
 * force is read from platform_settings.money_rounding. A missing or
 * different value is refused. This constant is the rule's name, not a rate.
 */
export const SETTLEMENT_ROUNDING_RULE = "half_away_from_zero";

export function roundingIsConfigured(rule: string | null | undefined) {
  return rule === SETTLEMENT_ROUNDING_RULE;
}

export function assertSettlementRounding(rule: string | null | undefined) {
  if (!roundingIsConfigured(rule)) {
    throw new Error("settlement_rounding_unspecified");
  }
}
