import { NextResponse } from "next/server";
import { toPublicOrder } from "@/lib/events/public-guest";
import { GUEST_BODY_BYTES, isUuid } from "@/lib/orders/guest-input";
import { paymentFailureResponse } from "@/lib/payments/http";
import { paymentIdempotencyKey, readIdempotencyKey } from "@/lib/payments/idempotency";
import { getDemoPaymentProvider } from "@/lib/payments/provider";
import { cancelDemoOrder, presentOrder } from "@/lib/payments/service";
import { PAYMENTS_LIVE_NOT_ENABLED } from "@/lib/payments/messages";
import { guestOrderMissResponse, guardPaymentIp, guardPaymentSlug } from "@/lib/security/guest-guard";
import { readLimitedJson } from "@/lib/security/guest-http";
import { getOrderForGuest } from "@/lib/orders/repository";

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
    const provider = getDemoPaymentProvider();
    if (!provider) {
      return NextResponse.json({ error: PAYMENTS_LIVE_NOT_ENABLED }, { status: 503 });
    }
    const current = await getOrderForGuest(orderId, accessToken);
    if (!current) {
      return guestOrderMissResponse();
    }
    const slugLimited = await guardPaymentSlug(request, current.eventSlug, current.eventId);
    if (slugLimited) {
      return slugLimited;
    }
    const idempotencyKey = readIdempotencyKey(
      body.idempotencyKey,
      paymentIdempotencyKey(orderId, "cancel"),
    );
    const order = await presentOrder(await cancelDemoOrder(orderId, accessToken, idempotencyKey));
    return NextResponse.json(toPublicOrder(order));
  } catch (error) {
    const failure = paymentFailureResponse(error, "לא ניתן לבטל את ההזמנה.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
