import "server-only";
import { cookies } from "next/headers";
import { signScopedPayload, signaturesMatch } from "@/lib/security/hmac";

export const ADMIN_SESSION_COOKIE = "lolo_admin_session";
const SESSION_HOURS = 12;
const TOKEN_TYP = "admin";

type AdminSession = {
  typ: typeof TOKEN_TYP;
  role: "admin";
  exp: number;
};

function encodePayload(payload: AdminSession) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function createAdminSessionToken() {
  const payload: AdminSession = {
    typ: TOKEN_TYP,
    role: "admin",
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${signScopedPayload("ADMIN_SESSION_SECRET", TOKEN_TYP, encoded)}`;
}

export function readAdminSessionToken(token: string | undefined): AdminSession | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [encoded, signature] = parts;
  if (!encoded || !signature) {
    return null;
  }

  let expected: string;
  try {
    expected = signScopedPayload("ADMIN_SESSION_SECRET", TOKEN_TYP, encoded);
  } catch {
    return null;
  }

  if (!signaturesMatch(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as AdminSession;
    if (
      payload.typ !== TOKEN_TYP ||
      payload.role !== "admin" ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
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
