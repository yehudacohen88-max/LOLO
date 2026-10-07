import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { jsonFromError } from "@/lib/vouchers/http";
import { isUuid, parseOptionalAmount, parseOptionalReference } from "@/lib/vouchers/input";
import { VoucherActionError } from "@/lib/vouchers/messages";
import { getAdminVoucherDetail, redeemVoucher } from "@/lib/vouchers/repository";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ voucherId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  const { voucherId } = await context.params;
  if (!isUuid(voucherId)) {
    return NextResponse.json({ error: "השובר לא נמצא." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as { amount?: unknown; reference?: unknown };
    const voucher = await getAdminVoucherDetail(voucherId, "");
    if (!voucher) {
      throw new VoucherActionError("השובר לא נמצא.", 404);
    }
    const result = await redeemVoucher({
      storeId: voucher.storeId,
      channel: "admin",
      redeemedBy: "admin",
      amount: parseOptionalAmount(body.amount),
      reference: parseOptionalReference(body.reference),
      voucherId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonFromError(error, "המימוש נכשל.");
  }
}
