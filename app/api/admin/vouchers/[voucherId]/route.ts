import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { jsonFromError } from "@/lib/vouchers/http";
import { isUuid } from "@/lib/vouchers/input";
import { getAdminVoucherDetail } from "@/lib/vouchers/repository";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ voucherId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  const { voucherId } = await context.params;
  if (!isUuid(voucherId)) {
    return NextResponse.json({ error: "השובר לא נמצא." }, { status: 404 });
  }

  try {
    const detail = await getAdminVoucherDetail(voucherId, "");
    if (!detail) {
      return NextResponse.json({ error: "השובר לא נמצא." }, { status: 404 });
    }
    return NextResponse.json({
      voucherId: detail.card.id,
      canRedeem: detail.canRedeem,
      canCancel: detail.canCancel,
      balance: {
        voucherId: detail.card.id,
        amount: detail.card.amount,
        remainingAmount: detail.card.remainingAmount,
        status: detail.card.status,
        expiresAt: detail.card.expiresAt,
        redemptions: detail.card.redemptions,
      },
    });
  } catch (error) {
    return jsonFromError(error, "לא ניתן לטעון את השובר.");
  }
}
