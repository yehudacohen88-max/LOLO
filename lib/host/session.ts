import "server-only";
import { signScopedPayload, signaturesMatch } from "@/lib/security/hmac";

export const HOST_SESSION_COOKIE = "lolo_host_session";
const SESSION_HOURS = 12;
const TOKEN_TYP = "host";

type HostSession = {
  typ: typeof TOKEN_TYP;
  eventId: string;
  exp: number;
};

function encodePayload(payload: HostSession) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function createHostSessionToken(eventId: string) {
  const payload: HostSession = {
    typ: TOKEN_TYP,
    eventId,
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${signScopedPayload("HOST_SESSION_SECRET", TOKEN_TYP, encoded)}`;
}

export function readHostSessionToken(token: string | undefined): HostSession | null {
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
    expected = signScopedPayload("HOST_SESSION_SECRET", TOKEN_TYP, encoded);
  } catch {
    return null;
  }

  if (!signaturesMatch(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as HostSession;
    if (
      payload.typ !== TOKEN_TYP ||
      typeof payload.eventId !== "string" ||
      !payload.eventId ||
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

export function hostSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  };
}
