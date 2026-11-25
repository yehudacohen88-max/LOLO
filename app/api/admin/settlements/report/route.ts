import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import {
  jsonFromSettlementError,
  settlementCsvResponse,
  settlementPilotUnavailable,
} from "@/lib/settlements/http";
import { settlementReportCsv } from "@/lib/settlements/report-csv";
import { loadSettlementReport } from "@/lib/settlements/reports";

export const dynamic = "force-dynamic";

export async function GET() {
  const closed = settlementPilotUnavailable();
  if (closed) {
    return closed;
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    const statement = await loadSettlementReport();
    return settlementCsvResponse("lolo-settlements.csv", settlementReportCsv(statement.rows));
  } catch (error) {
    return jsonFromSettlementError(error, "הורדת הדוח נכשלה.");
  }
}
