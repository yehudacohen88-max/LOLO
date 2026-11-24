import { NextResponse } from "next/server";
import type { Db } from "@/lib/desk/db";
import { deskDb, deskError, forbidden, requireAdmin } from "@/lib/desk/http";
import { listPaymentAttempts } from "@/lib/desk/payments-adapter";

export const dynamic = "force-dynamic";

export async function handleAdminPayments(db?: Db) {
  if (!(await requireAdmin())) {
    return forbidden();
  }
  try {
    const attempts = await listPaymentAttempts(deskDb(db));
    return NextResponse.json({ attempts });
  } catch (error) {
    return deskError(error, "טעינת התשלומים נכשלה.");
  }
}

export function GET() {
  return handleAdminPayments();
}
