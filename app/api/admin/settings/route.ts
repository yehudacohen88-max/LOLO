import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { getGuestFeeSettings, saveGuestFeeSettings } from "@/lib/admin/guest-fee";
import { parseGuestFeeSettings } from "@/lib/admin/guest-fee-input";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    const settings = await getGuestFeeSettings();
    return NextResponse.json({
      guestFeeEnabled: settings.enabled,
      guestFeePercent: settings.percent,
      guestFeeFixed: settings.fixedAmount,
    });
  } catch (error) {
    const body = caughtErrorBody(error, "טעינת ההגדרות נכשלה.", 500);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}

export async function PUT(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    const settings = parseGuestFeeSettings(await request.json());
    await saveGuestFeeSettings(settings);
    return NextResponse.json({
      guestFeeEnabled: settings.enabled,
      guestFeePercent: settings.percent,
      guestFeeFixed: settings.fixedAmount,
    });
  } catch (error) {
    const body = caughtErrorBody(error, "שמירת ההגדרות נכשלה.");
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
