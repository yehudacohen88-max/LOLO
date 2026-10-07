import { NextResponse } from "next/server";
import { getDemoPaymentProvider } from "@/lib/payments/provider";
import type { PaymentOutcome } from "@/lib/payments/types";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      orderId?: string;
      accessToken?: string;
      outcome?: string;
    };
    const orderId = body.orderId?.trim() ?? "";
    const accessToken = body.accessToken?.trim() ?? "";
    if (!orderId || !accessToken) {
      return NextResponse.json({ error: "חסר מזהה הזמנה." }, { status: 400 });
    }
    if (body.outcome !== "success" && body.outcome !== "failure") {
      return NextResponse.json({ error: "בקשת התשלום אינה תקינה." }, { status: 400 });
    }

    const provider = getDemoPaymentProvider();
    if (!provider?.confirmDemoPayment) {
      return NextResponse.json(
        { error: "אישור התשלום אינו זמין באמצעי התשלום הנוכחי." },
        { status: 400 },
      );
    }

    const outcome: PaymentOutcome = body.outcome;
    const order = await provider.confirmDemoPayment({
      orderId,
      accessToken,
      outcome,
    });

    return NextResponse.json(order);
  } catch (error) {
    const body = caughtErrorBody(error, "אישור התשלום נכשל.");
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
