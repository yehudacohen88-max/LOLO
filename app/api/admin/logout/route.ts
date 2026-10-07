import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
} from "@/lib/admin/session";

export async function POST() {
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions(),
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
