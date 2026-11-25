import { NextResponse } from "next/server";
import type { Db } from "@/lib/desk/db";
import { deskDb, deskError, forbidden, requireAdmin } from "@/lib/desk/http";
import { listPaymentRefunds } from "@/lib/desk/payments-adapter";

export const dynamic = "force-dynamic";

export async function handleAdminRefunds(db?: Db) {
  if (!(await requireAdmin())) {
    return forbidden();
  }
  try {
    const refunds = await listPaymentRefunds(deskDb(db));
    return NextResponse.json({ refunds });
  } catch (error) {
    return deskError(error, "טעינת ההחזרים נכשלה.");
  }
}

export function GET() {
  return handleAdminRefunds();
}
