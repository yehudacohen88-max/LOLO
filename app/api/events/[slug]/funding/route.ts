import { NextResponse } from "next/server";
import { isPublicEventSlug } from "@/lib/beta/guest-access";
import { toPublicFunding } from "@/lib/events/public-guest";
import { canonicalEventSlug } from "@/lib/events/slug";
import { loadEventFunding } from "@/lib/funding/public-progress";
import { guestEventMissResponse, guardGuestRead, rememberGuestMiss } from "@/lib/security/guest-guard";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const limited = await guardGuestRead(request);
  if (limited) {
    return limited;
  }

  const canonical = canonicalEventSlug(slug);
  if (!isPublicEventSlug(canonical)) {
    rememberGuestMiss(request);
    return guestEventMissResponse();
  }

  try {
    const funding = await loadEventFunding(canonical);
    if (!funding) {
      rememberGuestMiss(request);
      return guestEventMissResponse();
    }

    return NextResponse.json(toPublicFunding(funding));
  } catch (error) {
    const body = caughtErrorBody(error, "טעינת ההתקדמות נכשלה.", 500);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
