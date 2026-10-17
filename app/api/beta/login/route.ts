import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  BETA_ATTEMPT_COOKIE,
  BETA_ATTEMPT_WINDOW_MS,
  BETA_SESSION_COOKIE,
  BETA_SESSION_MS,
  betaAttemptLocked,
  betaCookieOptions,
  betaGateModeFromEnv,
  betaPasswordMatches,
  clientIpFromHeaders,
  createBetaSessionValue,
  nextBetaAttemptValue,
  readBetaAttemptValue,
  safeNextPath,
} from "@/lib/beta/gate";

export const dynamic = "force-dynamic";

function loginRedirect(request: Request, next: string, notice: string) {
  const url = new URL("/beta", request.url);
  url.searchParams.set("next", next);
  url.searchParams.set("notice", notice);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return loginRedirect(request, "/", "invalid");
  }
  const next = safeNextPath(String(form.get("next") ?? ""));
  const mode = betaGateModeFromEnv();

  if (mode === "open") {
    return NextResponse.redirect(new URL(next, request.url), 303);
  }
  if (mode === "misconfigured") {
    return loginRedirect(request, next, "setup");
  }

  const secret = process.env.BETA_ACCESS_SECRET?.trim() ?? "";
  const password = process.env.BETA_ACCESS_PASSWORD?.trim() ?? "";
  const ip = clientIpFromHeaders(request.headers);
  const jar = await cookies();
  const current = await readBetaAttemptValue(
    secret,
    jar.get(BETA_ATTEMPT_COOKIE)?.value,
    ip,
  );

  if (betaAttemptLocked(current)) {
    return loginRedirect(request, next, "locked");
  }

  const supplied = String(form.get("password") ?? "");
  const matches = await betaPasswordMatches(supplied, password);
  if (!matches) {
    const nextAttempt = await nextBetaAttemptValue(secret, current, ip);
    const response = loginRedirect(
      request,
      next,
      betaAttemptLocked(nextAttempt.state) ? "locked" : "invalid",
    );
    response.cookies.set(BETA_ATTEMPT_COOKIE, nextAttempt.token, {
      ...betaCookieOptions(Math.ceil(BETA_ATTEMPT_WINDOW_MS / 1000)),
    });
    return response;
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(
    BETA_SESSION_COOKIE,
    await createBetaSessionValue(secret),
    betaCookieOptions(Math.ceil(BETA_SESSION_MS / 1000)),
  );
  response.cookies.set(BETA_ATTEMPT_COOKIE, "", betaCookieOptions(0));
  return response;
}
