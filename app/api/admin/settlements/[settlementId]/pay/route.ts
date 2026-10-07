import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { jsonFromSettlementError } from "@/lib/settlements/http";
import { parsePaySettlementInput } from "@/lib/settlements/input";
import { markSettlementPaid } from "@/lib/settlements/repository";
import { isUuid } from "@/lib/vouchers/input";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ settlementId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  const { settlementId } = await context.params;
  if (!isUuid(settlementId)) {
    return NextResponse.json({ error: "ההתחשבנות לא נמצאה." }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const input = parsePaySettlementInput(body);
    const result = await markSettlementPaid(settlementId, input.reference, input.method);
    return NextResponse.json(result);
  } catch (error) {
    return jsonFromSettlementError(error, "סימון התשלום נכשל.");
  }
}
