import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  STORE_SESSION_COOKIE,
  storeSessionCookieOptions,
} from "@/lib/store/session";

export async function POST() {
  const jar = await cookies();
  jar.set(STORE_SESSION_COOKIE, "", {
    ...storeSessionCookieOptions(),
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
