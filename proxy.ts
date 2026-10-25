import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  BETA_SESSION_COOKIE,
  betaGateModeFromEnv,
  readBetaSessionValue,
  safeNextPath,
} from "@/lib/beta/gate";
import { isGuestDirectAccess } from "@/lib/beta/guest-access";

function destination(request: NextRequest) {
  return safeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`);
}

export async function proxy(request: NextRequest) {
  const mode = betaGateModeFromEnv();
  if (mode === "open") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (/[A-Z]/.test(pathname)) {
    const lowered = pathname.toLowerCase();
    if (isGuestDirectAccess(lowered, request.method)) {
      const url = request.nextUrl.clone();
      url.pathname = lowered;
      const rewritten = NextResponse.rewrite(url);
      if (lowered.startsWith("/e/") || lowered.startsWith("/i/")) {
        rewritten.headers.set("X-Robots-Tag", "noindex, nofollow");
      }
      return rewritten;
    }
  }

  if (pathname === "/beta" || pathname === "/api/beta/login") {
    return NextResponse.next();
  }

  if (isGuestDirectAccess(pathname, request.method)) {
    const response = NextResponse.next();
    if (pathname.startsWith("/e/") || pathname.startsWith("/i/")) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return response;
  }

  if (mode === "ready") {
    const session = await readBetaSessionValue(
      process.env.BETA_ACCESS_SECRET?.trim() ?? "",
      request.cookies.get(BETA_SESSION_COOKIE)?.value,
    );
    if (session) {
      return NextResponse.next();
    }
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: mode === "misconfigured" ? "גישת הבטא עדיין לא הוגדרה." : "נדרשת כניסה לבטא." },
      { status: mode === "misconfigured" ? 503 : 401 },
    );
  }

  const login = new URL("/beta", request.url);
  login.searchParams.set("next", destination(request));
  if (mode === "misconfigured") {
    login.searchParams.set("notice", "setup");
  }
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
