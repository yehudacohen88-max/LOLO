import { NextResponse } from "next/server";
import { resolveInviteToken } from "@/lib/host/guest-list";
import { canonicalEventSlug } from "@/lib/events/slug";
import {
  createInviteSessionToken,
  inviteSessionCookieOptions,
  INVITE_SESSION_COOKIE,
} from "@/lib/invite/session";
import { guardGuestRead } from "@/lib/security/guest-guard";

type RouteContext = {
  params: Promise<{ token?: string | string[] }>;
};

function withRobots(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

const INVITE_MISS_TITLE = "ההזמנה לא נמצאה";
const INVITE_MISS_BODY = "הקישור האישי אינו פעיל. בקשו מהמארח לשלוח הזמנה חדשה.";

function hebrewStatusResponse(status: number, title: string, body: string) {
  const html = `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${title} | LOLO</title>
  </head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fcfaf7;color:#16204d;font-family:Heebo,Arial Hebrew,Arial,sans-serif;text-align:center;padding:24px">
    <main>
      <p style="letter-spacing:-0.04em;font-weight:700;font-size:28px;color:#16204d">lolo</p>
      <h1 style="margin-top:24px;font-size:32px;line-height:1.3">${title}</h1>
      <p style="margin-top:12px;color:#525b82;line-height:1.6;font-size:18px">${body}</p>
      <a href="/" style="display:inline-flex;margin-top:24px;min-height:48px;align-items:center;border-radius:999px;background:#d63e2a;color:#fff;padding:0 24px;font-weight:700;text-decoration:none">לדף הבית</a>
    </main>
  </body>
</html>`;
  return withRobots(
    new NextResponse(html, {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
  );
}

function inviteMissResponse() {
  return hebrewStatusResponse(404, INVITE_MISS_TITLE, INVITE_MISS_BODY);
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export async function GET(request: Request, context: RouteContext) {
  const limited = await guardGuestRead(request);
  if (limited) {
    return limited;
  }

  try {
    const params = context.params ? await context.params : undefined;
    const raw = firstParam(params?.token) || new URL(request.url).pathname.split("/").pop() || "";
    let token = raw.trim();
    try {
      token = decodeURIComponent(token);
    } catch {
      token = raw.trim();
    }

    const resolved = token ? await resolveInviteToken(token) : null;
    if (!resolved?.slug) {
      return inviteMissResponse();
    }

    const origin = new URL(request.url).origin;
    const location = `${origin}/e/${encodeURIComponent(canonicalEventSlug(resolved.slug))}`;
    const response = withRobots(NextResponse.redirect(location));
    response.cookies.set(
      INVITE_SESSION_COOKIE,
      createInviteSessionToken({
        eventId: resolved.eventId,
        guestId: resolved.guestId,
        name: resolved.name,
        phone: resolved.phone,
      }),
      inviteSessionCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error("[LOLO] invite link", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return hebrewStatusResponse(
      503,
      "השירות אינו זמין כרגע",
      "נסו שוב מאוחר יותר.",
    );
  }
}
