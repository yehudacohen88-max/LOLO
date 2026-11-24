/**
 * Names that may count as real money.
 * Empty until a live provider exists and has been reviewed.
 * Adding a name here classifies stored payments with that name as real money.
 * Do not add a name before its provider implementation exists.
 * "demo" and "none" are never real, even if they appear in a list passed to tests.
 */
export const REAL_PROVIDER_ALLOWLIST = [] as const;

/**
 * Local-database tests only. Production classification stays on the empty
 * allow-list. "demo" and "none" are still rejected inside
 * isAllowListedRealProvider.
 */
let localTestAllowlist: readonly string[] | null = null;

export function setLocalRealProviderAllowlist(allowlist: readonly string[] | null) {
  if (process.env.LOLO_LOCAL_DB !== "1") {
    throw new Error("The provider allow-list can be widened only while LOLO_LOCAL_DB=1.");
  }
  localTestAllowlist = allowlist;
}

export function activeRealProviderAllowlist(): readonly string[] {
  return localTestAllowlist ?? REAL_PROVIDER_ALLOWLIST;
}

export function isAllowListedRealProvider(
  name: string,
  allowlist: readonly string[] = activeRealProviderAllowlist(),
) {
  const normalized = name.trim().toLowerCase();
  if (!normalized || normalized === "demo" || normalized === "none") {
    return false;
  }
  return allowlist.some((entry) => entry.trim().toLowerCase() === normalized);
}
