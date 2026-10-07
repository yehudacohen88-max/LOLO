import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { jsonFromSettlementError } from "@/lib/settlements/http";
import { cancelSettlement } from "@/lib/settlements/repository";
import { isUuid } from "@/lib/vouchers/input";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ settlementId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  const { settlementId } = await context.params;
  if (!isUuid(settlementId)) {
    return NextResponse.json({ error: "ההתחשבנות לא נמצאה." }, { status: 404 });
  }

  try {
    const result = await cancelSettlement(settlementId);
    return NextResponse.json(result);
  } catch (error) {
    return jsonFromSettlementError(error, "ביטול ההתחשבנות נכשל.");
  }
}
