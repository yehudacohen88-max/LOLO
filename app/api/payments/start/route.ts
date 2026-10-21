import { NextResponse } from "next/server";
import { toPublicPaymentStart } from "@/lib/events/public-guest";
import { GUEST_BODY_BYTES, isUuid } from "@/lib/orders/guest-input";
import { getOrderForGuest } from "@/lib/orders/repository";
import { getPaymentProvider } from "@/lib/payments/provider";
import { clientIpFromRequest } from "@/lib/security/login-limit";
import { takePaymentIp, takePaymentSlug } from "@/lib/security/guest-limit";
import { guestLimitResponse, readLimitedJson } from "@/lib/security/guest-http";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limited = guestLimitResponse(takePaymentIp(ip));
  if (limited) {
    return limited;
  }

  const parsed = await readLimitedJson(request, GUEST_BODY_BYTES.payment);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const body = parsed.value as { orderId?: string; accessToken?: string };
  const orderId = body.orderId?.trim() ?? "";
  const accessToken = body.accessToken?.trim() ?? "";
  if (!isUuid(orderId) || !isUuid(accessToken)) {
    return NextResponse.json({ error: "לא מצאנו את ההזמנה." }, { status: 400 });
  }

  try {
    const order = await getOrderForGuest(orderId, accessToken);
    if (!order) {
      return NextResponse.json({ error: "ההזמנה לא נמצאה." }, { status: 404 });
    }

    const slugLimited = guestLimitResponse(takePaymentSlug(order.eventSlug));
    if (slugLimited) {
      return slugLimited;
    }

    const provider = getPaymentProvider();
    const started = await provider.startPayment(order);

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
    const failure = caughtErrorBody(error, "לא ניתן להתחיל את התשלום.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
