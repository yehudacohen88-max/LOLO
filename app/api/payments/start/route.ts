import { NextResponse } from "next/server";
import { toPublicPaymentStart } from "@/lib/events/public-guest";
import { GUEST_BODY_BYTES, isUuid } from "@/lib/orders/guest-input";
import { guestCheckoutAllowed } from "@/lib/guest-draft";
import { getOrderForGuest } from "@/lib/orders/repository";
import { paymentFailureResponse } from "@/lib/payments/http";
import { paymentIdempotencyKey, readIdempotencyKey } from "@/lib/payments/idempotency";
import { getPaymentProvider } from "@/lib/payments/provider";
import { guestOrderMissResponse, guardPaymentIp, guardPaymentSlug } from "@/lib/security/guest-guard";
import { readLimitedJson } from "@/lib/security/guest-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = guardPaymentIp(request);
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
    idempotencyKey?: string;
  };
  const orderId = body.orderId?.trim() ?? "";
  const accessToken = body.accessToken?.trim() ?? "";
  if (!isUuid(orderId) || !isUuid(accessToken)) {
    return guestOrderMissResponse();
  }

  try {
    const order = await getOrderForGuest(orderId, accessToken);
    if (!order) {
      return guestOrderMissResponse();
    }

    if (!guestCheckoutAllowed(order.contributionAmount)) {
      return NextResponse.json({ error: "עדיין לא נבחרה מתנה." }, { status: 400 });
    }

    const slugLimited = await guardPaymentSlug(request, order.eventSlug, order.eventId);
    if (slugLimited) {
      return slugLimited;
    }

    const provider = getPaymentProvider();
    const idempotencyKey = readIdempotencyKey(
      body.idempotencyKey,
      paymentIdempotencyKey(orderId, "start"),
    );
    const started = await provider.start({ order, idempotencyKey });

    return NextResponse.json(
      toPublicPaymentStart({
        provider: provider.name,
        isDemo: provider.isDemo,
        orderId: order.id,
        status: started.status,
        checkoutUrl: started.checkoutUrl,
        contributionAmount: order.contributionAmount,
        feeAmount: order.feeAmount,
        chargedAmount: order.chargedAmount,
      }),
    );
  } catch (error) {
    const failure = paymentFailureResponse(error, "לא ניתן להתחיל את התשלום.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
