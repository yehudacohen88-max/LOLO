import { NextResponse } from "next/server";
import type { Db } from "@/lib/desk/db";
import { csvResponse, deskDb, deskError } from "@/lib/desk/http";
import { DESK_FORBIDDEN } from "@/lib/desk/messages";
import { listStoreTransactions, readTransactionQuery } from "@/lib/desk/transactions";
import { storeTransactionsCsv } from "@/lib/desk/transactions-csv";
import { getStoreSession } from "@/lib/store/session";

export const dynamic = "force-dynamic";

export async function handleStoreTransactionsExport(request: Request, db?: Db) {
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
    if (!page.available) {
      return NextResponse.json({ error: page.message }, { status: 503 });
    }
    return csvResponse("lolo-store-redemptions.csv", storeTransactionsCsv(page));
  } catch (error) {
    return deskError(error, "הורדת הקובץ נכשלה.");
  }
}

export function GET(request: Request) {
  return handleStoreTransactionsExport(request);
}
