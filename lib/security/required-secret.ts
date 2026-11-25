import "server-only";
import { isPreviewDisconnected } from "@/lib/supabase/preview-guard";

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
  return (
    (error instanceof Error && error.name === "ServiceUnavailableError") ||
    isPreviewDisconnected(error)
  );
}

export function serviceUnavailableMessage(error?: unknown) {
  if (isServiceUnavailable(error) && error instanceof Error && error.message) {
    return error.message;
  }
  return SERVICE_UNAVAILABLE_MESSAGE;
}

export function caughtErrorBody(
  error: unknown,
  fallback: string,
  fallbackStatus = 400,
) {
  if (isServiceUnavailable(error)) {
    return { error: serviceUnavailableMessage(error), status: 503 };
  }
  return {
    error: error instanceof Error && error.message ? error.message : fallback,
    status: fallbackStatus,
  };
}

export function resetMissingEnvWarnings() {
  logged.clear();
}
