/**
 * Names that may count as real money.
 * Empty until a live provider exists and has been reviewed.
 * Adding a name here classifies stored payments with that name as real money.
 * Do not add a name before its provider implementation exists.
 * "demo" and "none" are never real, even if they appear in a list passed to tests.
 */
export const REAL_PROVIDER_ALLOWLIST = [] as const;

export function isAllowListedRealProvider(
  name: string,
  allowlist: readonly string[] = REAL_PROVIDER_ALLOWLIST,
) {
  const normalized = name.trim().toLowerCase();
  if (!normalized || normalized === "demo" || normalized === "none") {
    return false;
  }
  return allowlist.some((entry) => entry.trim().toLowerCase() === normalized);
}
