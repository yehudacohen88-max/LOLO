import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearLoginFailures,
  clientIpFromRequest,
  LOGIN_LIMIT_MESSAGE,
  loginAttemptAllowed,
  loginRetryAfterSeconds,
  recordLoginFailure,
} from "@/lib/security/login-limit";
import { isServiceUnavailable } from "@/lib/security/required-secret";
import {
  createStoreSessionToken,
  STORE_SESSION_COOKIE,
  storeSessionCookieOptions,
} from "@/lib/store/session";
import { jsonFromError } from "@/lib/vouchers/http";
import { VoucherSchemaMissingError } from "@/lib/vouchers/messages";
import { findStoreForLogin } from "@/lib/vouchers/repository";

const GENERIC_ERROR = "שם הכניסה או קוד הכניסה שגויים.";

function limitedResponse(ip: string) {
  const retryAfter = loginRetryAfterSeconds("store", ip);
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
  if (!loginAttemptAllowed("store", ip)) {
    return limitedResponse(ip);
  }

  try {
    const body = (await request.json()) as { slug?: unknown; accessCode?: unknown };
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const accessCode = typeof body.accessCode === "string" ? body.accessCode : "";
    if (!slug || !accessCode.trim()) {
      recordLoginFailure("store", ip);
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const storeId = await findStoreForLogin(slug, accessCode);
    if (!storeId) {
      recordLoginFailure("store", ip);
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const jar = await cookies();
    jar.set(STORE_SESSION_COOKIE, createStoreSessionToken(storeId), storeSessionCookieOptions());
    clearLoginFailures("store", ip);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (!(error instanceof VoucherSchemaMissingError) && !isServiceUnavailable(error)) {
      recordLoginFailure("store", ip);
    }
    return jsonFromError(error, GENERIC_ERROR);
  }
}
