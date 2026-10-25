import { NextResponse } from "next/server";
import { isPublicEventSlug } from "@/lib/beta/guest-access";
import { loadGuestEvent } from "@/lib/events/load-guest-event";
import { canonicalEventSlug } from "@/lib/events/slug";
import { toPublicGuestEvent } from "@/lib/events/public-guest";
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
    const event = await loadGuestEvent(canonical);
    if (!event || canonicalEventSlug(event.slug) !== canonical) {
      rememberGuestMiss(request);
      return guestEventMissResponse();
    }
    return NextResponse.json({ event: toPublicGuestEvent(event) });
  } catch (error) {
    const body = caughtErrorBody(error, "טעינת האירוע נכשלה.", 500);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
