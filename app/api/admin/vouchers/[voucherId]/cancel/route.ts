import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { jsonFromError } from "@/lib/vouchers/http";
import { isUuid } from "@/lib/vouchers/input";
import { cancelVoucher } from "@/lib/vouchers/repository";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ voucherId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  const { voucherId } = await context.params;
  if (!isUuid(voucherId)) {
    return NextResponse.json({ error: "השובר לא נמצא." }, { status: 404 });
  }

  try {
    await cancelVoucher(voucherId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonFromError(error, "ביטול השובר נכשל.");
  }
}
