import { NextResponse } from "next/server";
import {
  addEventGuest,
  listEventGuests,
  requireHostEventSession,
} from "@/lib/host/guest-list";
import { caughtErrorBody } from "@/lib/security/required-secret";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await requireHostEventSession(eventId);
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    const guests = await listEventGuests(session.eventId);
    return NextResponse.json({ guests });
  } catch (error) {
    const body = caughtErrorBody(error, "טעינת רשימת האורחים נכשלה.", 500);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await requireHostEventSession(eventId);
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { name?: string; phone?: string };
    const guest = await addEventGuest(session.eventId, {
      name: body.name ?? "",
      phone: body.phone ?? "",
    });
    return NextResponse.json({ guest });
  } catch (error) {
    const body = caughtErrorBody(error, "הוספת האורח נכשלה.");
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
