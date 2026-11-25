import { NextResponse } from "next/server";
import type { Db } from "@/lib/desk/db";
import { deskDb, deskError } from "@/lib/desk/http";
import { DESK_FORBIDDEN } from "@/lib/desk/messages";
import { listStoreTransactions, readTransactionQuery } from "@/lib/desk/transactions";
import { getStoreSession } from "@/lib/store/session";

export const dynamic = "force-dynamic";

export async function handleStoreTransactions(request: Request, db?: Db) {
  const session = await getStoreSession();
  if (!session) {
    return NextResponse.json({ error: DESK_FORBIDDEN }, { status: 401 });
  }
  try {
    const page = await listStoreTransactions(
      session.storeId,
      readTransactionQuery(request.url),
      deskDb(db),
    );
    return NextResponse.json(page);
  } catch (error) {
    return deskError(error, "טעינת המימושים נכשלה.");
  }
}

export function GET(request: Request) {
  return handleStoreTransactions(request);
}
