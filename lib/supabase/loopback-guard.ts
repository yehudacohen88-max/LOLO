import "server-only";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function parseHttpUrl(value: string) {
  const normalized = value
    .trim()
    .replace(/\r/g, "")
    .replace(/^['"]|['"]$/g, "");
  const url = new URL(normalized);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("Only http(s) URLs can be a loopback host.");
  }
  return url;
}

/** True only for localhost, 127.0.0.1, and ::1. Throws when the value is not an http(s) URL. */
export function supabaseUrlIsLoopback(value: string) {
  return LOOPBACK_HOSTS.has(parseHttpUrl(value).hostname.toLowerCase());
}

/**
 * True only when this process is configured to talk to a loopback Supabase.
 * A remote URL, including the production database used by previews, is closed.
 */
export function localDatabaseUiAllowed() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!raw.trim()) {
    return false;
  }
  try {
    return supabaseUrlIsLoopback(raw);
  } catch {
    return false;
  }
}
