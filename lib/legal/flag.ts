/**
 * Draft legal pages and collection notices stay hidden until this is set.
 * Unset, empty, and any value other than 1 / true / yes / on are off,
 * including in production. The variable is read with a computed key so the
 * build does not bake a public default into the client bundle.
 */
export const LEGAL_DRAFTS_FLAG = "LEGAL_DRAFTS_ENABLED";

const ENABLED = new Set(["1", "true", "yes", "on"]);

export function legalDraftsEnabled(raw: string | undefined | null) {
  return ENABLED.has((raw ?? "").trim().toLowerCase());
}

export function legalDraftsEnabledFromEnv(
  env: { [key: string]: string | undefined } = process.env,
) {
  return legalDraftsEnabled(env[LEGAL_DRAFTS_FLAG]);
}

/** True when this path is a draft legal route and the flag is off. */
export function legalDraftPathHidden(pathname: string, enabled: boolean) {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const legal = path === "/legal" || path.startsWith("/legal/");
  return legal && !enabled;
}
