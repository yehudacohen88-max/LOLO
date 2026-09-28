import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function normalizeSupabaseUrl(raw: string) {
  let url = raw.trim().replace(/\r/g, "").replace(/^['"]|['"]$/g, "");
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/rest\/v1$/i, "");
  return url;
}

function requestUrlOf(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

async function tracedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const requestUrl = requestUrlOf(input);
  const method =
    init?.method ??
    (typeof input === "object" && !(input instanceof URL) ? input.method : "GET");

  console.info("[LOLO] Supabase fetch", { method, url: requestUrl });

  try {
    return await fetch(input, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "Error";
    console.error("[LOLO] Supabase fetch failed", {
      method,
      url: requestUrl,
      name,
      message,
    });
    throw new Error(`${name}: ${message} [${method} ${requestUrl}]`);
  }
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedUrl = normalizeSupabaseUrl(url);
  const normalizedKey = anonKey.trim().replace(/\r/g, "").replace(/^['"]|['"]$/g, "");

  if (!browserClient) {
    try {
      const origin = new URL(normalizedUrl).origin;
      console.info("[LOLO] Supabase client origin", origin);
    } catch {
      console.error("[LOLO] Invalid NEXT_PUBLIC_SUPABASE_URL", {
        message: "URL must be https://PROJECT.supabase.co",
      });
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL חייב להיות כתובת הפרויקט: https://PROJECT.supabase.co",
      );
    }

    browserClient = createClient(normalizedUrl, normalizedKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: tracedFetch,
      },
    });
  }

  return browserClient;
}
