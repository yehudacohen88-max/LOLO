import type { Db, DbError } from "@/lib/desk/db";
import { isMissingRelation } from "@/lib/desk/db";
import { AUDIT_UNAVAILABLE } from "@/lib/desk/messages";

const ACTOR = /^[a-z][a-z0-9._:-]{0,79}$/;
const ACTION = /^[a-z][a-z0-9._-]{0,79}$/;
const SUBJECT = /^[a-z0-9][a-z0-9:._/-]{0,159}$/;
const SECRET_KEY = /password|passwd|secret|token|cookie|authorization|code|hash|api_key/i;

export type DeskAuditInput = {
  actor: string;
  action: string;
  subject?: string;
  metadata?: Record<string, unknown>;
};

export type DeskAuditResult =
  | { recorded: true }
  | { recorded: false; reason: "unavailable" | "rejected" };

function scrub(metadata: Record<string, unknown> | undefined) {
  const source = metadata ?? {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (SECRET_KEY.test(key)) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      clean[key] = value;
    }
  }
  return clean;
}

export function scrubAuditMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {} as Record<string, unknown>;
  }
  return scrub(metadata as Record<string, unknown>);
}

/**
 * Writes one row to audit_events when that table exists.
 * This is not lib/audit/record.ts. When that helper is merged, call sites
 * can switch to it. A missing table returns unavailable and does not throw.
 */
export async function recordDeskAudit(
  input: DeskAuditInput,
  db: Db,
): Promise<DeskAuditResult> {
  const actor = input.actor.trim();
  const action = input.action.trim();
  const subject = (input.subject ?? "").trim();
  if (!ACTOR.test(actor) || !ACTION.test(action) || (subject && !SUBJECT.test(subject))) {
    return { recorded: false, reason: "rejected" };
  }

  try {
    const result = await db.from("audit_events").insert({
      actor,
      action,
      subject,
      metadata: scrub(input.metadata),
    });
    if (!result.error) {
      return { recorded: true };
    }
    if (isMissingRelation(result.error, "audit_events")) {
      return { recorded: false, reason: "unavailable" };
    }
    return { recorded: false, reason: "rejected" };
  } catch {
    return { recorded: false, reason: "unavailable" };
  }
}

export type AuditEventRow = {
  id: string;
  actor: string;
  action: string;
  subject: string;
  at: string;
  metadata: Record<string, unknown>;
};

export async function listAuditEvents(db: Db): Promise<
  | { available: false; message: string; rows: [] }
  | { available: true; message: ""; rows: AuditEventRow[] }
> {
  try {
    const result = await db
      .from("audit_events")
      .select("id, actor, action, subject, at, metadata")
      .order("at", { ascending: false })
      .limit(200);
    if (result.error) {
      if (isMissingRelation(result.error, "audit_events") || isMissingColumnSafe(result.error)) {
        return { available: false, message: AUDIT_UNAVAILABLE, rows: [] };
      }
      throw result.error;
    }
    const rows = (Array.isArray(result.data) ? result.data : []) as Array<{
      id: string;
      actor: string;
      action: string;
      subject: string;
      at: string;
      metadata: unknown;
    }>;
    return {
      available: true,
      message: "",
      rows: rows.map((row) => ({
        id: row.id,
        actor: row.actor,
        action: row.action,
        subject: row.subject ?? "",
        at: row.at,
        metadata: scrubAuditMetadata(row.metadata),
      })),
    };
  } catch (error) {
    const dbError = error as DbError;
    if (isMissingRelation(dbError, "audit_events")) {
      return { available: false, message: AUDIT_UNAVAILABLE, rows: [] };
    }
    throw error;
  }
}

function isMissingColumnSafe(error: DbError) {
  const code = error.code ?? "";
  return code === "42703" || code === "PGRST204";
}
