import { NextResponse } from "next/server";
import { paymentFailureResponse } from "@/lib/payments/http";
import { applyDemoWebhook } from "@/lib/payments/service";
import { getPaymentProvider } from "@/lib/payments/provider";
import { WEBHOOK_BAD_PAYLOAD, PAYMENTS_LIVE_NOT_ENABLED } from "@/lib/payments/messages";
import { screenWebhook } from "@/lib/payments/webhook-screen";
import { WEBHOOK_SIGNATURE_HEADER } from "@/lib/payments/webhook-signature";
import { guardPaymentIp } from "@/lib/security/guest-guard";

export const dynamic = "force-dynamic";

const MAX_BYTES = 16_000;

export async function POST(request: Request) {
  const limited = guardPaymentIp(request);
  if (limited) {
    return limited;
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BYTES) {
    return NextResponse.json({ error: WEBHOOK_BAD_PAYLOAD }, { status: 400 });
  }

  const provider = getPaymentProvider();
  if (!provider.isDemo) {
    return NextResponse.json({ error: PAYMENTS_LIVE_NOT_ENABLED }, { status: 503 });
  }

  const screened = screenWebhook({
    rawBody,
    signature: request.headers.get(WEBHOOK_SIGNATURE_HEADER),
    secret: process.env.PAYMENT_WEBHOOK_SECRET?.trim() ?? "",
    verify: (input) => provider.verifyWebhook(input),
    parse: (body) => provider.parseEvent(body),
  });
  if (!screened.ok) {
    const status = screened.reason === "unconfigured" ? 503 : 400;
    return NextResponse.json({ error: screened.message }, { status });
  }

  try {
    const result = await applyDemoWebhook(screened.event);
    return NextResponse.json({ ok: true, replayed: result.replayed });
  } catch (error) {
    const failure = paymentFailureResponse(error, "עדכון התשלום נכשל.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
