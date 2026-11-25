import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  readRequiredEnv,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";
import {
  assertPreviewDatabaseAllowed,
  normalizeSupabaseUrl,
} from "@/lib/supabase/preview-guard";

export function getSupabaseServiceClient() {
  if (typeof window !== "undefined") {
    console.error("[LOLO] Service role client was reached from the browser.");
    const error = new Error(SERVICE_UNAVAILABLE_MESSAGE);
    error.name = "ServiceUnavailableError";
    throw error;
  }

  if (process.env.VERCEL_ENV === "preview") {
    assertPreviewDatabaseAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  }

  const url = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const normalizedUrl = normalizeSupabaseUrl(url);
  assertPreviewDatabaseAllowed(normalizedUrl);

  return createClient(normalizedUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
