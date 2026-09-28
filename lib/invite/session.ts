import { createHmac, timingSafeEqual } from "node:crypto";

export const INVITE_SESSION_COOKIE = "lolo_invite_session";
const SESSION_DAYS = 30;

export type InviteSession = {
  eventId: string;
  guestId: string;
  name: string;
  phone: string;
  exp: number;
};

function sessionSecret() {
  return (
    process.env.INVITE_TOKEN_SECRET ||
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
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createInviteSessionToken(input: {
  eventId: string;
  guestId: string;
  name: string;
  phone: string;
}) {
  const payload: InviteSession = {
    eventId: input.eventId,
    guestId: input.guestId,
    name: input.name,
    phone: input.phone,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encoded}.${sign(encoded)}`;
}

export function readInviteSessionToken(
  token: string | undefined,
): InviteSession | null {
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
    ) as InviteSession;
    if (
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
