import "server-only";
import { cookies } from "next/headers";
import { signScopedPayload, signaturesMatch } from "@/lib/security/hmac";

export const STORE_SESSION_COOKIE = "lolo_store_session";
const SESSION_HOURS = 12;
const TOKEN_TYP = "store";

type StoreSession = {
  typ: typeof TOKEN_TYP;
  storeId: string;
  exp: number;
};

function encodePayload(payload: StoreSession) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function createStoreSessionToken(storeId: string) {
  const payload: StoreSession = {
    typ: TOKEN_TYP,
    storeId,
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${signScopedPayload("STORE_SESSION_SECRET", TOKEN_TYP, encoded)}`;
}

export function readStoreSessionToken(token: string | undefined): StoreSession | null {
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
    expected = signScopedPayload("STORE_SESSION_SECRET", TOKEN_TYP, encoded);
  } catch {
    return null;
  }

  if (!signaturesMatch(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as StoreSession;
    if (
      payload.typ !== TOKEN_TYP ||
      typeof payload.storeId !== "string" ||
      !payload.storeId ||
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

export function storeSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  };
}

export async function getStoreSession() {
  const jar = await cookies();
  return readStoreSessionToken(jar.get(STORE_SESSION_COOKIE)?.value);
}
