import { NextResponse } from "next/server";
import type { Db } from "@/lib/desk/db";
import { listDeskEvents } from "@/lib/desk/directory";
import { deskDb, deskError, forbidden, requireAdmin } from "@/lib/desk/http";

export const dynamic = "force-dynamic";

export async function handleAdminEvents(request: Request, db?: Db) {
  if (!(await requireAdmin())) {
    return forbidden();
  }
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const events = await listDeskEvents(deskDb(db), q);
    return NextResponse.json({ events });
  } catch (error) {
    return deskError(error, "טעינת האירועים נכשלה.");
  }
}

export function GET(request: Request) {
  return handleAdminEvents(request);
}
