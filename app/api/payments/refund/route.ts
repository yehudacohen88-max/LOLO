import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { GUEST_BODY_BYTES, isUuid } from "@/lib/orders/guest-input";
import { paymentFailureResponse } from "@/lib/payments/http";
import { readIdempotencyKey } from "@/lib/payments/idempotency";
import { REFUND_DEMO_ONLY } from "@/lib/payments/messages";
import { getPaymentProvider } from "@/lib/payments/provider";
import { guestOrderMissResponse, guardPaymentIp } from "@/lib/security/guest-guard";
import { readLimitedJson } from "@/lib/security/guest-http";
import { roundMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    const limited = guardPaymentIp(request);
    if (limited) {
      return limited;
    }
  }

  const parsed = await readLimitedJson(request, GUEST_BODY_BYTES.payment);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const body = parsed.value as {
    orderId?: string;
    accessToken?: string;
    amount?: number;
    idempotencyKey?: string;
    reason?: string;
  };
  const orderId = body.orderId?.trim() ?? "";
  const accessToken = body.accessToken?.trim() ?? "";
  if (!isUuid(orderId) || (!admin && !isUuid(accessToken))) {
    return admin
      ? NextResponse.json({ error: "ההזמנה לא נמצאה." }, { status: 404 })
      : guestOrderMissResponse();
  }

  const amount = roundMoney(Number(body.amount));
  if (!(amount > 0)) {
    return NextResponse.json({ error: "סכום ההחזר אינו תקין." }, { status: 400 });
  }
  const reason = (body.reason ?? "").trim();
  if (reason.length > 200) {
    return NextResponse.json({ error: "הסיבה ארוכה מדי." }, { status: 400 });
  }

  try {
    const idempotencyKey = readIdempotencyKey(body.idempotencyKey);
    const provider = getPaymentProvider();
    if (!provider.isDemo) {
      return NextResponse.json({ error: REFUND_DEMO_ONLY }, { status: 400 });
    }
    const record = await provider.refund({
      orderId,
      accessToken: accessToken || null,
      actor: admin ? "admin" : "guest",
      amount,
      idempotencyKey,
      reason,
    });
    return NextResponse.json({
      id: record.providerReference,
      orderId: record.orderId,
      amount: record.amount,
      status: record.status,
      simulated: record.simulated,
      provider: record.provider,
      replayed: record.replayed,
      externalUrl: record.externalUrl,
    });
  } catch (error) {
    if (!admin && error instanceof Error && error.message === "ההזמנה לא נמצאה.") {
      return guestOrderMissResponse();
    }
    const failure = paymentFailureResponse(error, "לא ניתן לרשום את ההחזר.");
    const status = admin && failure.error === "ההזמנה לא נמצאה." ? 404 : failure.status;
    return NextResponse.json({ error: failure.error }, { status });
  }
}
