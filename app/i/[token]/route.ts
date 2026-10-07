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
      return new NextResponse("ההזמנה לא נמצאה.", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
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
    return new NextResponse("השירות אינו זמין כרגע. נסו שוב מאוחר יותר.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
