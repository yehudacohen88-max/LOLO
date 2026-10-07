import "server-only";
import { signScopedPayload, signaturesMatch } from "@/lib/security/hmac";

export const INVITE_SESSION_COOKIE = "lolo_invite_session";
const SESSION_DAYS = 30;
const TOKEN_TYP = "invite";

export type InviteSession = {
  typ: typeof TOKEN_TYP;
  eventId: string;
  guestId: string;
  name: string;
  phone: string;
  exp: number;
};

function encodePayload(payload: InviteSession) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function createInviteSessionToken(input: {
  eventId: string;
  guestId: string;
  name: string;
  phone: string;
}) {
  const payload: InviteSession = {
    typ: TOKEN_TYP,
    eventId: input.eventId,
    guestId: input.guestId,
    name: input.name,
    phone: input.phone,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${signScopedPayload("INVITE_TOKEN_SECRET", TOKEN_TYP, encoded)}`;
}

export function readInviteSessionToken(
  token: string | undefined,
): InviteSession | null {
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
    expected = signScopedPayload("INVITE_TOKEN_SECRET", TOKEN_TYP, encoded);
  } catch {
    return null;
  }

  if (!signaturesMatch(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as InviteSession;
    if (
      payload.typ !== TOKEN_TYP ||
      typeof payload.eventId !== "string" ||
      !payload.eventId ||
      typeof payload.guestId !== "string" ||
      !payload.guestId ||
      typeof payload.name !== "string" ||
      typeof payload.phone !== "string" ||
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

export function inviteSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}
