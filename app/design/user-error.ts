const HEBREW = /[\u0590-\u05FF]/;
const RAW_NETWORK =
  /failed to fetch|networkerror|network request failed|load failed|aborted|timeout|econn|enotfound|socket/i;

/** Keep a Hebrew product message. Replace browser and server raw strings. */
export function userFacingMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message.trim() : "";
  if (!raw || RAW_NETWORK.test(raw) || !HEBREW.test(raw)) {
    return fallback;
  }
  return raw;
}
