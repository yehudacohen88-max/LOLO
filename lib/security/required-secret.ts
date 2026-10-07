import "server-only";

export const SERVICE_UNAVAILABLE_MESSAGE =
  "השירות אינו זמין כרגע. נסו שוב מאוחר יותר.";

const logged = new Set<string>();

export function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) {
    if (!logged.has(name)) {
      logged.add(name);
      console.error(`[LOLO] Missing required environment variable: ${name}`);
    }
    const error = new Error(SERVICE_UNAVAILABLE_MESSAGE);
    error.name = "ServiceUnavailableError";
    throw error;
  }
  return value;
}

export function isServiceUnavailable(error: unknown) {
  return error instanceof Error && error.name === "ServiceUnavailableError";
}

export function caughtErrorBody(
  error: unknown,
  fallback: string,
  fallbackStatus = 400,
) {
  if (isServiceUnavailable(error)) {
    return { error: SERVICE_UNAVAILABLE_MESSAGE, status: 503 };
  }
  return {
    error: error instanceof Error && error.message ? error.message : fallback,
    status: fallbackStatus,
  };
}

export function resetMissingEnvWarnings() {
  logged.clear();
}
