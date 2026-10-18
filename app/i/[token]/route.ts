import { NextResponse } from "next/server";
import { resolveInviteToken } from "@/lib/host/guest-list";
import { normalizeEventSlug } from "@/lib/events/slug";
import {
  createInviteSessionToken,
  inviteSessionCookieOptions,
  INVITE_SESSION_COOKIE,
} from "@/lib/invite/session";

type RouteContext = {
  params: Promise<{ token?: string | string[] }>;
};

function hebrewStatusResponse(status: number, title: string, body: string) {
  const html = `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} | LOLO</title>
  </head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fbfafc;color:#1c1528;font-family:Heebo,Arial,sans-serif;text-align:center;padding:24px">
    <main>
      <p style="letter-spacing:.28em;font-weight:800;color:#6d28d9">LOLO</p>
      <h1 style="margin-top:24px;font-size:28px">${title}</h1>
      <p style="margin-top:12px;color:#6b6178;line-height:1.6">${body}</p>
      <a href="/" style="display:inline-flex;margin-top:24px;height:48px;align-items:center;border-radius:999px;background:#6d28d9;color:white;padding:0 24px;font-weight:700;text-decoration:none">לדף הבית</a>
    </main>
  </body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export async function GET(request: Request, context: RouteContext) {
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
      return hebrewStatusResponse(
        404,
        "ההזמנה לא נמצאה",
        "הקישור האישי אינו פעיל. בקשו מהמארח לשלוח הזמנה חדשה.",
      );
    }

    const origin = new URL(request.url).origin;
    const location = `${origin}/e/${encodeURIComponent(normalizeEventSlug(resolved.slug))}`;
    const response = NextResponse.redirect(location);
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
