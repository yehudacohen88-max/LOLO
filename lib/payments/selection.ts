export type ProviderKind = "demo" | "none" | "unconfigured-live";

/**
 * No env var is required. An empty value selects demo checkout, which never
 * moves real money. "none" keeps the old pending-only behavior. Any other
 * name is reserved for a future live provider and must not be treated as demo.
 *
 * Browser confirm stays on that demo path only. An explicit "demo" value
 * matches an unset provider. Any other value refuses the browser confirm.
 */
export function demoBrowserConfirmEnabled(raw: string | undefined) {
  return resolveProviderKind(raw) === "demo";
}

export function resolveProviderKind(raw: string | undefined): ProviderKind {
  const name = (raw ?? "").trim().toLowerCase();
  if (name === "" || name === "demo") {
    return "demo";
  }
  if (name === "none") {
    return "none";
  }
  return "unconfigured-live";
}
