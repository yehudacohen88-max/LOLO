import "server-only";
import { hostSchemaUnavailable, isMissingColumn } from "@/lib/host/schema-error";
import type { StoredSessionVersion } from "@/lib/host/session-version";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function readStoredSessionVersion(eventId: string): Promise<StoredSessionVersion> {
  const supabase = getSupabaseServiceClient();
  const result = await supabase
    .from("event_host_access")
    .select("session_version")
    .eq("event_id", eventId)
    .maybeSingle();

  if (result.error) {
    if (isMissingColumn(result.error, "session_version")) {
      return "legacy";
    }
    throw hostSchemaUnavailable();
  }
  if (!result.data) {
    return "missing";
  }
  const version = Number(result.data.session_version);
  if (!Number.isInteger(version) || version < 0) {
    throw hostSchemaUnavailable();
  }
  return version;
}
