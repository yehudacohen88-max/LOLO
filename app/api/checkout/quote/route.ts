import { NextResponse } from "next/server";
import { quoteContribution } from "@/lib/orders/repository";
import { GUEST_BODY_BYTES, guestItemsProblem, publicSlugOrNull } from "@/lib/orders/guest-input";
import type { OrderItemInput } from "@/lib/orders/types";
import { toPublicQuote } from "@/lib/events/public-guest";
import { getPaymentProvider } from "@/lib/payments/provider";
import { clientIpFromRequest } from "@/lib/security/login-limit";
import { takeQuote } from "@/lib/security/guest-limit";
import { guestLimitResponse, readLimitedJson } from "@/lib/security/guest-http";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await readLimitedJson(request, GUEST_BODY_BYTES.quote);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const body = parsed.value as { slug?: string; items?: OrderItemInput[] };
  const slug = publicSlugOrNull(body.slug ?? "");
  if (!slug) {
    return NextResponse.json({ error: "האירוע לא נמצא." }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items : [];
  const problem = guestItemsProblem(items);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const limited = guestLimitResponse(takeQuote(clientIpFromRequest(request), slug));
  if (limited) {
    return limited;
  }

  try {
    const amounts = await quoteContribution(slug, items);
    const provider = getPaymentProvider();

    return NextResponse.json(
      toPublicQuote({
        contributionAmount: amounts.contributionAmount,
        feeAmount: amounts.feeAmount,
        chargedAmount: amounts.chargedAmount,
        feeEnabled: amounts.feeEnabled,
        provider: provider.name,
        isDemo: provider.isDemo,
      }),
    );
  } catch (error) {
    const failure = caughtErrorBody(error, "לא ניתן לחשב את הסכום לתשלום.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
