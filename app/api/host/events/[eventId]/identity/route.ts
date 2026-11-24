import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readStoredSessionVersion } from "@/lib/host/access-version";
import { linkEventToEmail, readIdentitySession } from "@/lib/host/identity-server";
import {
  createHostIdentityToken,
  HOST_IDENTITY_COOKIE,
  hostIdentityCookieOptions,
} from "@/lib/host/identity-session";
import { HOST_SESSION_COOKIE, readHostSessionToken } from "@/lib/host/session";
import { hostSessionVersionMatches } from "@/lib/host/session-version";
import { readLimitedJson } from "@/lib/security/guest-http";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const jar = await cookies();
  const session = readHostSessionToken(jar.get(HOST_SESSION_COOKIE)?.value);
  if (!session || session.eventId !== eventId) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  const parsed = await readLimitedJson(request, 4_000);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const email =
    parsed.value && typeof parsed.value === "object" && "email" in parsed.value
      ? String((parsed.value as { email?: unknown }).email ?? "")
      : "";

  try {
    const stored = await readStoredSessionVersion(eventId);
    if (!hostSessionVersionMatches(session, stored)) {
      return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
    }
    const identity = await readIdentitySession();
    const linked = await linkEventToEmail({
      eventId,
      email,
      identityId: identity?.identityId ?? null,
    });
    jar.set(
      HOST_IDENTITY_COOKIE,
      createHostIdentityToken(linked.identityId),
      hostIdentityCookieOptions(),
    );
    return NextResponse.json({ linked: true });
  } catch (error) {
    const body = caughtErrorBody(error, "קישור האירוע נכשל.");
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
