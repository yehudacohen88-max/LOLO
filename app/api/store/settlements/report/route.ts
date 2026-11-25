import { NextResponse } from "next/server";
import {
  jsonFromSettlementError,
  settlementCsvResponse,
  settlementPilotUnavailable,
} from "@/lib/settlements/http";
import { settlementReportCsv } from "@/lib/settlements/report-csv";
import { loadSettlementReport } from "@/lib/settlements/reports";
import { getStoreSession } from "@/lib/store/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const closed = settlementPilotUnavailable();
  if (closed) {
    return closed;
  }

  const session = await getStoreSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    const statement = await loadSettlementReport(session.storeId);
    return settlementCsvResponse("lolo-store-settlement.csv", settlementReportCsv(statement.rows));
  } catch (error) {
    return jsonFromSettlementError(error, "הורדת הדוח נכשלה.");
  }
}
