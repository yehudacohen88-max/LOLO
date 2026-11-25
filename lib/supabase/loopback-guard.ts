// Loopback gate for the local UI. The Production project ref is the same
// constant scripts/local-db-order.mjs exports. This module does not connect.

export const PRODUCTION_PROJECT_REF = "fafvveudrlovaozazkny";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

export function supabaseUrlIsLoopback(value: string) {
  if (!value || value.toLowerCase().includes(PRODUCTION_PROJECT_REF)) {
    return false;
  }
  try {
    return LOOPBACK.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

/** True only for the local Docker app, never for a hosted or empty URL. */
export function localDatabaseUiAllowed() {
  return (
    process.env.LOLO_LOCAL_DB === "1" &&
    supabaseUrlIsLoopback(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  );
}
