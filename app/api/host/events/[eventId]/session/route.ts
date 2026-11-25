import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readStoredSessionVersion } from "@/lib/host/access-version";
import { identityOwnsEvent, readIdentitySession } from "@/lib/host/identity-server";
import { hostSchemaUnavailable } from "@/lib/host/schema-error";
import {
  createHostSessionToken,
  HOST_SESSION_COOKIE,
  hostSessionCookieOptions,
} from "@/lib/host/session";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const identity = await readIdentitySession();
  if (!identity) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    const owns = await identityOwnsEvent(identity.identityId, eventId);
    if (!owns) {
      return NextResponse.json({ error: "אין הרשאה." }, { status: 404 });
    }
    const stored = await readStoredSessionVersion(eventId);
    if (typeof stored !== "number") {
      throw hostSchemaUnavailable();
    }
    const jar = await cookies();
    jar.set(HOST_SESSION_COOKIE, createHostSessionToken(eventId, stored), hostSessionCookieOptions());
    return NextResponse.json({ eventId });
  } catch (error) {
    const body = caughtErrorBody(error, "לא ניתן לפתוח את האירוע.", 500);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
