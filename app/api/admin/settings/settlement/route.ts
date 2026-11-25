import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { parseSettlementPolicyInput } from "@/lib/settlements/policy-input";
import { jsonFromSettlementError, settlementPilotUnavailable } from "@/lib/settlements/http";
import { readSettlementPolicy, saveSettlementPolicy } from "@/lib/settlements/reports";

export const dynamic = "force-dynamic";

function payload(policy: Awaited<ReturnType<typeof readSettlementPolicy>>) {
  return {
    defaultCommissionPercent: policy.fallbackCommissionPercent,
    defaultPaymentTermsDays: policy.fallbackPaymentTermsDays,
    moneyRounding: policy.rounding,
  };
}

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
    return NextResponse.json(payload(await readSettlementPolicy()));
  } catch (error) {
    return jsonFromSettlementError(error, "טעינת הגדרות ההתחשבנות נכשלה.");
  }
}

export async function PUT(request: Request) {
  const closed = settlementPilotUnavailable();
  if (closed) {
    return closed;
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    const policy = parseSettlementPolicyInput(await request.json());
    await saveSettlementPolicy(policy);
    return NextResponse.json(payload(policy));
  } catch (error) {
    return jsonFromSettlementError(error, "שמירת הגדרות ההתחשבנות נכשלה.");
  }
}
