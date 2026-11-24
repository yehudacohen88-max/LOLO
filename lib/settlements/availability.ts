/**
 * Settlements stay off until supabase/settlements.sql is approved and applied.
 * Unset, empty, and every value other than 1 / true / yes / on keep the
 * screens and settlement writes closed. Do not set this in production before
 * that SQL has been applied: the tables are not in the pilot database.
 */
export const SETTLEMENTS_PILOT_MESSAGE = "not available in pilot";

const ENABLED = new Set(["1", "true", "yes", "on"]);

export function settlementsEnabled(raw = process.env.SETTLEMENTS_ENABLED) {
  return ENABLED.has((raw ?? "").trim().toLowerCase());
}

export class SettlementPilotDisabledError extends Error {
  readonly status = 501;

  constructor() {
    super(SETTLEMENTS_PILOT_MESSAGE);
    this.name = "SettlementPilotDisabledError";
  }
}

export function assertSettlementsEnabled() {
  if (!settlementsEnabled()) {
    throw new SettlementPilotDisabledError();
  }
}
