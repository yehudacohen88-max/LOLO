import { NextResponse } from "next/server";
import { listAuditEvents } from "@/lib/desk/audit-adapter";
import type { Db } from "@/lib/desk/db";
import { deskDb, deskError, forbidden, requireAdmin } from "@/lib/desk/http";

export const dynamic = "force-dynamic";

export async function handleAdminAudit(db?: Db) {
  if (!(await requireAdmin())) {
    return forbidden();
  }
  try {
    return NextResponse.json(await listAuditEvents(deskDb(db)));
  } catch (error) {
    return deskError(error, "טעינת היומן נכשלה.");
  }
}

export function GET() {
  return handleAdminAudit();
}
