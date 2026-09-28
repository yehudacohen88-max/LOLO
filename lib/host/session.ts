import { createHmac, timingSafeEqual } from "node:crypto";

export const HOST_SESSION_COOKIE = "lolo_host_session";
const SESSION_HOURS = 12;

type HostSession = {
  eventId: string;
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
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createHostSessionToken(eventId: string) {
  const payload: HostSession = {
    eventId,
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encoded}.${sign(encoded)}`;
}

export function readHostSessionToken(token: string | undefined): HostSession | null {
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
    ) as HostSession;
    if (
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
