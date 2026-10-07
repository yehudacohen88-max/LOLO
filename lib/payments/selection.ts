export type ProviderKind = "demo" | "none" | "unconfigured-live";

/**
 * No env var is required. An empty value selects demo checkout, which never
 * moves real money. "none" keeps the old pending-only behavior. Any other
 * name is reserved for a future live provider and must not be treated as demo.
 */
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
