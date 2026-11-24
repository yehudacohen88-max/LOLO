import type { Db } from "@/lib/desk/db";
import { isMissingRelation, rowsOf } from "@/lib/desk/db";
import { recordDeskAudit } from "@/lib/desk/audit-adapter";
import {
  AUDIT_UNAVAILABLE,
  DeskError,
  NOTES_UNAVAILABLE,
} from "@/lib/desk/messages";
import { isUuid } from "@/lib/vouchers/input";

export type NoteSubject = "order" | "event";

export type SupportNote = {
  id: string;
  subjectKind: NoteSubject;
  subjectId: string;
  body: string;
  createdAt: string;
};

type NoteRow = {
  id: string;
  subject_kind: NoteSubject;
  subject_id: string;
  body: string;
  created_at: string;
};

export function parseSupportNote(value: unknown): {
  subjectKind: NoteSubject;
  subjectId: string;
  body: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DeskError("הנתונים שנשלחו אינם תקינים.");
  }
  const body = value as Record<string, unknown>;
  const kind = body.subjectKind;
  if (kind !== "order" && kind !== "event") {
    throw new DeskError("אפשר לצרף הערה להזמנה או לאירוע.");
  }
  if (typeof body.subjectId !== "string" || !isUuid(body.subjectId)) {
    throw new DeskError("הרשומה לא נמצאה.");
  }
  if (typeof body.body !== "string") {
    throw new DeskError("נא לכתוב הערה.");
  }
  const text = body.body.trim();
  if (!text || text.length > 2000) {
    throw new DeskError("ההערה צריכה להיות בין תו אחד ל-2,000 תווים.");
  }
  return {
    subjectKind: kind === "event" ? "event" : "order",
    subjectId: body.subjectId.toLowerCase(),
    body: text,
  };
}

export async function listSupportNotes(
  kind: NoteSubject,
  subjectId: string,
  db: Db,
): Promise<{ available: boolean; message: string; notes: SupportNote[] }> {
  if (!isUuid(subjectId)) {
    return { available: true, message: "", notes: [] };
  }
  const result = await db
    .from("support_notes")
    .select("id, subject_kind, subject_id, body, created_at")
    .eq("subject_kind", kind)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (result.error) {
    if (isMissingRelation(result.error, "support_notes")) {
      return { available: false, message: NOTES_UNAVAILABLE, notes: [] };
    }
    throw result.error;
  }
  return {
    available: true,
    message: "",
    notes: rowsOf<NoteRow>(result).map((row) => ({
      id: row.id,
      subjectKind: row.subject_kind,
      subjectId: row.subject_id,
      body: row.body,
      createdAt: row.created_at,
    })),
  };
}

async function subjectExists(kind: NoteSubject, subjectId: string, db: Db) {
  const table = kind === "order" ? "orders" : "events";
  const result = await db.from(table).select("id").eq("id", subjectId).maybeSingle();
  if (result.error) {
    throw result.error;
  }
  return Boolean(result.data);
}

export async function createSupportNote(
  input: { subjectKind: NoteSubject; subjectId: string; body: string },
  db: Db,
) {
  const exists = await subjectExists(input.subjectKind, input.subjectId, db);
  if (!exists) {
    throw new DeskError(input.subjectKind === "order" ? "ההזמנה לא נמצאה." : "האירוע לא נמצא.", 404);
  }

  const audit = await recordDeskAudit(
    {
      actor: "admin",
      action: "support_note.create",
      subject: `${input.subjectKind}:${input.subjectId}`,
      metadata: { kind: input.subjectKind },
    },
    db,
  );
  if (!audit.recorded) {
    throw new DeskError(AUDIT_UNAVAILABLE, 503);
  }

  const inserted = await db
    .from("support_notes")
    .insert({
      subject_kind: input.subjectKind,
      subject_id: input.subjectId,
      body: input.body,
    })
    .select("id")
    .maybeSingle();
  if (inserted.error) {
    if (isMissingRelation(inserted.error, "support_notes")) {
      throw new DeskError(NOTES_UNAVAILABLE, 503);
    }
    throw inserted.error;
  }
  const row = inserted.data as { id?: string } | null;
  if (!row?.id) {
    throw new DeskError("שמירת ההערה נכשלה.");
  }
  return row.id;
}
