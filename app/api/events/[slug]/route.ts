import { NextResponse } from "next/server";
import { loadGuestEvent } from "@/lib/events/load-guest-event";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;

  try {
    const event = await loadGuestEvent(slug);
    if (!event) {
      return NextResponse.json({ error: "האירוע לא נמצא." }, { status: 404 });
    }
    return NextResponse.json({ event });
  } catch (error) {
    const body = caughtErrorBody(error, "טעינת האירוע נכשלה.", 500);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
