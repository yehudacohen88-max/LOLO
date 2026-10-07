import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminPasswordMatches } from "@/lib/admin/password";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSessionToken,
} from "@/lib/admin/session";

const GENERIC_ERROR = "קוד הניהול שגוי.";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (!adminPasswordMatches(password)) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const jar = await cookies();
    jar.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), adminSessionCookieOptions());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }
}
