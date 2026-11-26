// Fail closed on Vercel Preview unless an explicit non-Production database is allow-listed.
// This module does not connect and does not read secret values.

export const PRODUCTION_PROJECT_REF = "fafvveudrlovaozazkny";

export const PREVIEW_DISCONNECTED_ERROR_NAME = "PreviewDisconnectedError";

export const PREVIEW_DISCONNECTED_MESSAGE =
  "סביבת Preview מנותקת ממסד הנתונים של Production ואינה זמינה לכתיבה.";

export function normalizeSupabaseUrl(raw: string) {
  return raw
    .trim()
    .replace(/\r/g, "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
}

export function supabaseUrlLooksLikeProduction(url: string) {
  return normalizeSupabaseUrl(url).toLowerCase().includes(PRODUCTION_PROJECT_REF);
}

export type PreviewDatabaseEnv = {
  vercelEnv?: string;
  allowPreviewDbUrl?: string;
};

function allowListedPreviewUrl(url: string, allowRaw: string) {
  if (!allowRaw.trim()) {
    return false;
  }
  return normalizeSupabaseUrl(allowRaw) === normalizeSupabaseUrl(url);
}

/**
 * False on Vercel Preview unless the URL is allow-listed and is not Production.
 * Pass `env` to classify a specific environment without reading process.env.
 */
export function previewAllowsDatabaseUrl(url: string, env?: PreviewDatabaseEnv) {
  const vercelEnv = env ? (env.vercelEnv ?? "") : (process.env.VERCEL_ENV ?? "");
  const allowRaw = env
    ? (env.allowPreviewDbUrl ?? "")
    : (process.env.LOLO_ALLOW_PREVIEW_DB_URL ?? "");
  if (vercelEnv !== "preview") {
    return true;
  }
  const normalized = normalizeSupabaseUrl(url);
  if (!normalized || supabaseUrlLooksLikeProduction(normalized)) {
    return false;
  }
  return allowListedPreviewUrl(normalized, allowRaw);
}

export function createPreviewDisconnectedError() {
  const error = new Error(PREVIEW_DISCONNECTED_MESSAGE);
  error.name = PREVIEW_DISCONNECTED_ERROR_NAME;
  return error;
}

export function isPreviewDisconnected(error: unknown) {
  return error instanceof Error && error.name === PREVIEW_DISCONNECTED_ERROR_NAME;
}

export function assertPreviewDatabaseAllowed(url: string) {
  if (previewAllowsDatabaseUrl(url)) {
    return;
  }
  console.error(
    "[LOLO] Refusing a write-capable Supabase client on Vercel Preview.",
  );
  throw createPreviewDisconnectedError();
}
