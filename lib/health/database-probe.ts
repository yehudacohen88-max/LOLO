import { normalizeSupabaseUrl } from "@/lib/supabase/preview-guard";

const PROBE_ERROR = "database probe failed";

/**
 * One bounded read of public.events.
 * Uses fetch directly so the Supabase client cannot call Auth or JWKS
 * during construction, and so the service-role key stays in headers.
 * The response body is discarded and never copied into errors.
 */
export function databaseProbeUrl(supabaseUrl: string) {
  const endpoint = new URL("/rest/v1/events", normalizeSupabaseUrl(supabaseUrl));
  endpoint.searchParams.set("select", "id");
  endpoint.searchParams.set("limit", "1");
  return endpoint;
}

export async function probeSupabaseRest(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const endpoint = databaseProbeUrl(input.supabaseUrl);
  if (endpoint.href.includes(input.serviceRoleKey)) {
    throw new Error(PROBE_ERROR);
  }

  const response = await (input.fetchImpl ?? fetch)(endpoint, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    signal: input.signal,
    headers: {
      Accept: "application/json",
      apikey: input.serviceRoleKey,
      Authorization: `Bearer ${input.serviceRoleKey}`,
    },
  });

  await response.arrayBuffer().catch(() => undefined);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(PROBE_ERROR);
  }
}
