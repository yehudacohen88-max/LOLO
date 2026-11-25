import { NextResponse } from "next/server";
import type { Db } from "@/lib/desk/db";
import { listDeskOrders } from "@/lib/desk/directory";
import { deskDb, deskError, forbidden, requireAdmin } from "@/lib/desk/http";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["pending", "paid", "failed", "cancelled"]);

export async function handleAdminOrders(request: Request, db?: Db) {
  if (!(await requireAdmin())) {
    return forbidden();
  }
  try {
    const status = new URL(request.url).searchParams.get("status") ?? "";
    const page = await listDeskOrders(deskDb(db), STATUSES.has(status) ? status : undefined);
    return NextResponse.json(page);
  } catch (error) {
    return deskError(error, "טעינת ההזמנות נכשלה.");
  }
}

export function GET(request: Request) {
  return handleAdminOrders(request);
}
