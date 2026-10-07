import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "lolo_admin_session";
const SESSION_HOURS = 12;

type AdminSession = {
  role: "admin";
  exp: number;
};

function sessionSecret() {
  return (
    process.env.HOST_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function sign(value: string) {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("חסר מפתח שרת של Supabase.");
  }
  return createHmac("sha256", secret).update(`admin:${value}`).digest("base64url");
}

export function createAdminSessionToken() {
  const payload: AdminSession = {
    role: "admin",
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encoded}.${sign(encoded)}`;
}

export function readAdminSessionToken(token: string | undefined): AdminSession | null {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  let expected: string;
  try {
    expected = sign(encoded);
  } catch {
    return null;
  }

  const given = Buffer.from(signature);
  const good = Buffer.from(expected);
  if (given.length !== good.length || !timingSafeEqual(given, good)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as AdminSession;
    if (payload.role !== "admin" || typeof payload.exp !== "number" || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  };
}

export async function getAdminSession() {
  const jar = await cookies();
  return readAdminSessionToken(jar.get(ADMIN_SESSION_COOKIE)?.value);
}

export function adminPasswordIsConfigured() {
  return Boolean(process.env.LOLO_ADMIN_PASSWORD?.trim());
}
