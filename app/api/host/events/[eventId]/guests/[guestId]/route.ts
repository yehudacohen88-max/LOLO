import { NextResponse } from "next/server";
import {
  deleteEventGuest,
  requireHostEventSession,
} from "@/lib/host/guest-list";

type RouteContext = {
  params: Promise<{
    eventId?: string | string[];
    guestId?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }
  return value?.trim() ?? "";
}

function idsFromRequest(
  request: Request,
  params: { eventId?: string | string[]; guestId?: string | string[] } | undefined,
) {
  let eventId = firstParam(params?.eventId);
  let guestId = firstParam(params?.guestId);
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const eventsIndex = parts.indexOf("events");
  const guestsIndex = parts.lastIndexOf("guests");

  if (!eventId && eventsIndex >= 0) {
    eventId = parts[eventsIndex + 1] ?? "";
  }
  if (!guestId && guestsIndex >= 0) {
    guestId = parts[guestsIndex + 1] ?? "";
  }

  return { eventId, guestId };
}

export async function DELETE(request: Request, context: RouteContext) {
  const params = context.params ? await context.params : undefined;
  const { eventId, guestId } = idsFromRequest(request, params);
  const session = await requireHostEventSession(eventId);
  if (!session || !guestId) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    await deleteEventGuest(session.eventId, guestId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "הסרת האורח נכשלה.";
    const status = message.includes("חסר מפתח") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
