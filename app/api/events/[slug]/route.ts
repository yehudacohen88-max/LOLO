import { NextResponse } from "next/server";
import { loadGuestEvent } from "@/lib/events/load-guest-event";
import { toPublicGuestEvent } from "@/lib/events/public-guest";
import { clientIpFromRequest } from "@/lib/security/login-limit";
import { beginGuestRead, noteGuestMiss } from "@/lib/security/guest-limit";
import { guestLimitResponse } from "@/lib/security/guest-http";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const ip = clientIpFromRequest(request);
  const limited = guestLimitResponse(beginGuestRead(ip));
  if (limited) {
    return limited;
  }

  try {
    const event = await loadGuestEvent(slug);
    if (!event) {
      noteGuestMiss(ip);
      return NextResponse.json({ error: "האירוע לא נמצא." }, { status: 404 });
    }
    return NextResponse.json({ event: toPublicGuestEvent(event) });
  } catch (error) {
    const body = caughtErrorBody(error, "טעינת האירוע נכשלה.", 500);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
