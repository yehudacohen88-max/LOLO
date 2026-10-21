import { NextResponse } from "next/server";
import { toPublicFunding } from "@/lib/events/public-guest";
import { loadEventFunding } from "@/lib/funding/public-progress";
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
    const funding = await loadEventFunding(slug);
    if (!funding) {
      noteGuestMiss(ip);
      return NextResponse.json({ error: "האירוע לא נמצא." }, { status: 404 });
    }

    return NextResponse.json(toPublicFunding(funding));
  } catch (error) {
    const body = caughtErrorBody(error, "טעינת ההתקדמות נכשלה.", 500);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
