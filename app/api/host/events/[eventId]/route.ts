import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readStoredSessionVersion } from "@/lib/host/access-version";
import { editHostEvent } from "@/lib/host/event-edit-server";
import { HOST_SESSION_COOKIE, readHostSessionToken } from "@/lib/host/session";
import { hostSessionVersionMatches } from "@/lib/host/session-version";
import { readLimitedJson } from "@/lib/security/guest-http";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

const EDIT_BODY_BYTES = 48_000;

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const jar = await cookies();
  const session = readHostSessionToken(jar.get(HOST_SESSION_COOKIE)?.value);
  if (!session || session.eventId !== eventId) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  const parsed = await readLimitedJson(request, EDIT_BODY_BYTES);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return NextResponse.json({ error: "הבקשה אינה תקינה." }, { status: 400 });
  }

  try {
    const stored = await readStoredSessionVersion(eventId);
    if (!hostSessionVersionMatches(session, stored)) {
      return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
    }
    const saved = await editHostEvent(eventId, parsed.value as Record<string, unknown>);
    return NextResponse.json({ ok: true, slug: saved.slug });
  } catch (error) {
    const body = caughtErrorBody(error, "שמירת האירוע נכשלה.");
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
