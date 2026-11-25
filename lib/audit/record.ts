import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { isServiceUnavailable } from "@/lib/security/required-secret";
import { redactAuditMetadata } from "@/lib/audit/redact";

const ACTOR = /^[a-z][a-z0-9._:-]{0,79}$/;
const ACTION = /^[a-z][a-z0-9._-]{0,79}$/;
const SUBJECT = /^[a-z0-9][a-z0-9:._/-]{0,159}$/;

const logged = new Set<string>();

export type AuditEventInput = {
  actor: string;
  action: string;
  subject?: string;
  metadata?: unknown;
};

export type AuditWriteResult =
  | { recorded: true }
  | { recorded: false; reason: "unconfigured" | "unavailable" | "rejected" };

export type AuditInsertError = { code?: string; message?: string };

export type AuditWriter = {
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: AuditInsertError | null }>;
  };
};

function note(reason: string, code?: string) {
  const key = `${reason}:${code ?? ""}`;
  if (logged.has(key)) {
    return;
  }
  logged.add(key);
  console.error("[LOLO] audit_events insert skipped", { reason, code: code ?? "" });
}

function isMissingAuditTable(error: AuditInsertError) {
  const code = error.code ?? "";
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204" || code === "42703") {
    return true;
  }
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("audit_events") &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("could not find"))
  );
}

function cleanSubject(subject: string | undefined) {
  const value = (subject ?? "").trim();
  if (!value) {
    return "";
  }
  return SUBJECT.test(value) ? value : "";
}

export async function recordAuditEvent(
  input: AuditEventInput,
  options?: { writer?: AuditWriter },
): Promise<AuditWriteResult> {
  const actor = input.actor.trim();
  const action = input.action.trim();
  if (!ACTOR.test(actor) || !ACTION.test(action)) {
    note("rejected");
    return { recorded: false, reason: "rejected" };
  }

  const row = {
    actor,
    action,
    subject: cleanSubject(input.subject),
    metadata: redactAuditMetadata(input.metadata),
  };

  let writer = options?.writer;
  if (!writer) {
    try {
      writer = getSupabaseServiceClient();
    } catch (error) {
      if (isServiceUnavailable(error)) {
        note("unconfigured");
        return { recorded: false, reason: "unconfigured" };
      }
      note("unavailable");
      return { recorded: false, reason: "unavailable" };
    }
  }

  try {
    const { error } = await writer.from("audit_events").insert(row);
    if (!error) {
      return { recorded: true };
    }
    if (isMissingAuditTable(error)) {
      note("unavailable", error.code);
      return { recorded: false, reason: "unavailable" };
    }
    note("rejected", error.code);
    return { recorded: false, reason: "rejected" };
  } catch {
    note("unavailable");
    return { recorded: false, reason: "unavailable" };
  }
}
