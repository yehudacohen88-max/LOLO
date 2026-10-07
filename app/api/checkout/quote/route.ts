import { NextResponse } from "next/server";
import { quoteContribution } from "@/lib/orders/repository";
import type { OrderItemInput } from "@/lib/orders/types";
import { getPaymentProvider } from "@/lib/payments/provider";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      slug?: string;
      items?: OrderItemInput[];
    };
    const amounts = await quoteContribution(
      body.slug ?? "",
      Array.isArray(body.items) ? body.items : [],
    );
    const provider = getPaymentProvider();

    return NextResponse.json({
      contributionAmount: amounts.contributionAmount,
      feeAmount: amounts.feeAmount,
      chargedAmount: amounts.chargedAmount,
      feeEnabled: amounts.feeEnabled,
      provider: provider.name,
      isDemo: provider.isDemo,
    });
  } catch (error) {
    const body = caughtErrorBody(error, "לא ניתן לחשב את הסכום לתשלום.");
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
