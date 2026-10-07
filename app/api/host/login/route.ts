import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hostAccessCodeMatches } from "@/lib/host/access-code";
import { slugFromHostIdentifier } from "@/lib/host/identifier";
import {
  createHostSessionToken,
  hostSessionCookieOptions,
  HOST_SESSION_COOKIE,
} from "@/lib/host/session";
import {
  clearLoginFailures,
  clientIpFromRequest,
  LOGIN_LIMIT_MESSAGE,
  loginAttemptAllowed,
  loginRetryAfterSeconds,
  recordLoginFailure,
} from "@/lib/security/login-limit";
import {
  isServiceUnavailable,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "קישור האירוע או קוד הניהול שגויים.";

function limitedResponse(ip: string) {
  const retryAfter = loginRetryAfterSeconds("host", ip);
  return NextResponse.json(
    { error: LOGIN_LIMIT_MESSAGE },
    {
      status: 429,
      headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
    },
  );
}

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  if (!loginAttemptAllowed("host", ip)) {
    return limitedResponse(ip);
  }

  try {
    const body = (await request.json()) as {
      identifier?: string;
      accessCode?: string;
    };
    const slug = slugFromHostIdentifier(body.identifier ?? "");
    const accessCode = body.accessCode ?? "";

    if (!slug || !accessCode.trim()) {
      recordLoginFailure("host", ip);
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: event } = await supabase
      .from("events")
      .select("id, slug")
      .eq("slug", slug)
      .maybeSingle();

    const { data: access } = event
      ? await supabase
          .from("event_host_access")
          .select("code_hash")
          .eq("event_id", event.id)
          .maybeSingle()
      : { data: null };

    const hash = access?.code_hash ?? "";
    const matches = await hostAccessCodeMatches(accessCode, hash);

    if (!event || !hash || !matches) {
      recordLoginFailure("host", ip);
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const token = createHostSessionToken(event.id);
    const jar = await cookies();
    jar.set(HOST_SESSION_COOKIE, token, hostSessionCookieOptions());
    clearLoginFailures("host", ip);

    return NextResponse.json({ eventId: event.id });
  } catch (error) {
    if (isServiceUnavailable(error)) {
      return NextResponse.json(
        { error: SERVICE_UNAVAILABLE_MESSAGE },
        { status: 503 },
      );
    }
    console.error("[LOLO] host login", {
      message: error instanceof Error ? error.message : "unknown",
    });
    recordLoginFailure("host", ip);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }
}
