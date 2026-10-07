import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminPasswordMatches } from "@/lib/admin/password";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSessionToken,
} from "@/lib/admin/session";
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

const GENERIC_ERROR = "קוד הניהול שגוי.";

function limitedResponse(ip: string) {
  const retryAfter = loginRetryAfterSeconds("admin", ip);
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
  if (!loginAttemptAllowed("admin", ip)) {
    return limitedResponse(ip);
  }

  try {
    const body = (await request.json()) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (!adminPasswordMatches(password)) {
      recordLoginFailure("admin", ip);
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const token = createAdminSessionToken();
    const jar = await cookies();
    jar.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());
    clearLoginFailures("admin", ip);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isServiceUnavailable(error)) {
      return NextResponse.json(
        { error: SERVICE_UNAVAILABLE_MESSAGE },
        { status: 503 },
      );
    }
    console.error("[LOLO] admin login", {
      message: error instanceof Error ? error.message : "unknown",
    });
    recordLoginFailure("admin", ip);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }
}
