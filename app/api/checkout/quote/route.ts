import { NextResponse } from "next/server";
import { quoteContribution } from "@/lib/orders/repository";
import { GUEST_BODY_BYTES, guestItemsProblem, publicSlugOrNull } from "@/lib/orders/guest-input";
import type { OrderItemInput } from "@/lib/orders/types";
import { loadGuestEvent } from "@/lib/events/load-guest-event";
import { toPublicQuote } from "@/lib/events/public-guest";
import { canonicalEventSlug } from "@/lib/events/slug";
import { getPaymentProvider } from "@/lib/payments/provider";
import { GUEST_EVENT_MISS } from "@/lib/security/guest-rate-decision";
import { guestEventMissResponse, guardQuoteLocal, guardSharedWrite } from "@/lib/security/guest-guard";
import { readLimitedJson } from "@/lib/security/guest-http";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await readLimitedJson(request, GUEST_BODY_BYTES.quote);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const body = parsed.value as { slug?: string; items?: OrderItemInput[] };
  const slug = publicSlugOrNull(body.slug ?? "");
  const items = Array.isArray(body.items) ? body.items : [];
  const problem = guestItemsProblem(items);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const localLimit = guardQuoteLocal(request, slug || "none");
  if (localLimit) {
    return localLimit;
  }

  const event = slug ? await loadGuestEvent(slug) : null;
  const visible = Boolean(event && canonicalEventSlug(event.slug) === slug);
  const limited = await guardSharedWrite(request, visible ? event!.id : "none");
  if (limited) {
    return limited;
  }
  if (!slug || !visible || !event) {
    return guestEventMissResponse();
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
    if (error instanceof Error && error.message === GUEST_EVENT_MISS.error) {
      return guestEventMissResponse();
    }
    const failure = caughtErrorBody(error, "לא ניתן לחשב את הסכום לתשלום.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
