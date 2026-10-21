import { NextResponse } from "next/server";
import { toPublicOrder } from "@/lib/events/public-guest";
import { GUEST_BODY_BYTES, isUuid } from "@/lib/orders/guest-input";
import { getOrderForGuest } from "@/lib/orders/repository";
import { getDemoPaymentProvider } from "@/lib/payments/provider";
import { demoBrowserConfirmEnabled } from "@/lib/payments/selection";
import type { PaymentOutcome } from "@/lib/payments/types";
import { clientIpFromRequest } from "@/lib/security/login-limit";
import { takePaymentIp, takePaymentSlug } from "@/lib/security/guest-limit";
import { guestLimitResponse, readLimitedJson } from "@/lib/security/guest-http";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

const UNAVAILABLE = "אישור התשלום אינו זמין באמצעי התשלום הנוכחי.";

export async function POST(request: Request) {
  if (!demoBrowserConfirmEnabled(process.env.PAYMENT_PROVIDER)) {
    return NextResponse.json({ error: UNAVAILABLE }, { status: 400 });
  }

  const limited = guestLimitResponse(takePaymentIp(clientIpFromRequest(request)));
  if (limited) {
    return limited;
  }

  const parsed = await readLimitedJson(request, GUEST_BODY_BYTES.payment);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const body = parsed.value as {
    orderId?: string;
    accessToken?: string;
    outcome?: string;
  };
  const orderId = body.orderId?.trim() ?? "";
  const accessToken = body.accessToken?.trim() ?? "";
  if (!isUuid(orderId) || !isUuid(accessToken)) {
    return NextResponse.json({ error: "לא מצאנו את ההזמנה." }, { status: 400 });
  }
  if (body.outcome !== "success" && body.outcome !== "failure") {
    return NextResponse.json({ error: "בקשת התשלום אינה תקינה." }, { status: 400 });
  }

  try {
    const current = await getOrderForGuest(orderId, accessToken);
    if (!current) {
      return NextResponse.json({ error: "ההזמנה לא נמצאה." }, { status: 404 });
    }
    const slugLimited = guestLimitResponse(takePaymentSlug(current.eventSlug));
    if (slugLimited) {
      return slugLimited;
    }

    const provider = getDemoPaymentProvider();
    if (!provider?.confirmDemoPayment) {
      return NextResponse.json({ error: UNAVAILABLE }, { status: 400 });
    }

    const outcome: PaymentOutcome = body.outcome;
    const order = await provider.confirmDemoPayment({
      orderId,
      accessToken,
      outcome,
    });

    return NextResponse.json(toPublicOrder(order));
  } catch (error) {
    const failure = caughtErrorBody(error, "אישור התשלום נכשל.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
