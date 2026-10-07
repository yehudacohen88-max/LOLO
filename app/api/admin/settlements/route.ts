import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { jsonFromSettlementError } from "@/lib/settlements/http";
import { parseCreateSettlementInput } from "@/lib/settlements/input";
import { createStoreSettlement } from "@/lib/settlements/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    const input = parseCreateSettlementInput(await request.json());
    const result = await createStoreSettlement(input.storeId, input.idempotencyKey);
    return NextResponse.json(result);
  } catch (error) {
    return jsonFromSettlementError(error, "יצירת ההתחשבנות נכשלה.");
  }
}
