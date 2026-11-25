import { NextResponse } from "next/server";
import { deskDb, deskError, forbidden, requireAdmin } from "@/lib/desk/http";
import type { Db } from "@/lib/desk/db";
import { createSupportNote, parseSupportNote } from "@/lib/desk/notes";

export const dynamic = "force-dynamic";

export async function handleAdminNote(request: Request, db?: Db) {
  if (!(await requireAdmin())) {
    return forbidden();
  }
  try {
    const input = parseSupportNote(await request.json());
    const id = await createSupportNote(input, deskDb(db));
    return NextResponse.json({ id });
  } catch (error) {
    return deskError(error, "שמירת ההערה נכשלה.");
  }
}

export function POST(request: Request) {
  return handleAdminNote(request);
}
