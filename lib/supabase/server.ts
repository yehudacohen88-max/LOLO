import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  readRequiredEnv,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";

function normalizeSupabaseUrl(raw: string) {
  return raw
    .trim()
    .replace(/\r/g, "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
}

export function getSupabaseServiceClient() {
  if (typeof window !== "undefined") {
    console.error("[LOLO] Service role client was reached from the browser.");
    const error = new Error(SERVICE_UNAVAILABLE_MESSAGE);
    error.name = "ServiceUnavailableError";
    throw error;
  }

  const url = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(normalizeSupabaseUrl(url), serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
