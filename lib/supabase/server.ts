import { createClient } from "@supabase/supabase-js";

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
    throw new Error("Service role client cannot run in the browser.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("חסר מפתח שרת של Supabase.");
  }

  return createClient(normalizeSupabaseUrl(url), serviceKey.trim(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
