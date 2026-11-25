import { NextResponse } from "next/server";
import type { Db } from "@/lib/desk/db";
import { listDeskGuests } from "@/lib/desk/directory";
import { deskDb, deskError, forbidden, requireAdmin } from "@/lib/desk/http";
import { isUuid } from "@/lib/vouchers/input";

export const dynamic = "force-dynamic";

export async function handleAdminGuests(request: Request, db?: Db) {
  if (!(await requireAdmin())) {
    return forbidden();
  }
  try {
    const event = new URL(request.url).searchParams.get("event") ?? "";
    const guests = await listDeskGuests(deskDb(db), isUuid(event) ? event : undefined);
    return NextResponse.json({ guests });
  } catch (error) {
    return deskError(error, "טעינת האורחים נכשלה.");
  }
}

export function GET(request: Request) {
  return handleAdminGuests(request);
}
