import { NextResponse } from "next/server";
import { getOrderForGuest } from "@/lib/orders/repository";
import { getPaymentProvider } from "@/lib/payments/provider";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      orderId?: string;
      accessToken?: string;
    };
    const orderId = body.orderId?.trim() ?? "";
    const accessToken = body.accessToken?.trim() ?? "";
    if (!orderId || !accessToken) {
      return NextResponse.json({ error: "חסר מזהה הזמנה." }, { status: 400 });
    }

    const order = await getOrderForGuest(orderId, accessToken);
    if (!order) {
      return NextResponse.json({ error: "ההזמנה לא נמצאה." }, { status: 404 });
    }

    const provider = getPaymentProvider();
    const started = await provider.startPayment(order);

    return NextResponse.json({
      provider: provider.name,
      isDemo: provider.isDemo,
      orderId: order.id,
      status: started.status,
      checkoutUrl: started.checkoutUrl,
      contributionAmount: order.contributionAmount,
      feeAmount: order.feeAmount,
      chargedAmount: order.chargedAmount,
    });
  } catch (error) {
    const body = caughtErrorBody(error, "לא ניתן להתחיל את התשלום.");
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
