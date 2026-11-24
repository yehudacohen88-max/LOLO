import "server-only";
import { signScopedPayload, signaturesMatch } from "@/lib/security/hmac";

export const HOST_IDENTITY_COOKIE = "lolo_host_identity";
const SESSION_HOURS = 8;
const TOKEN_TYP = "host_identity";

type HostIdentitySession = {
  typ: typeof TOKEN_TYP;
  identityId: string;
  exp: number;
};

function encodePayload(payload: HostIdentitySession) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function createHostIdentityToken(identityId: string) {
  const payload: HostIdentitySession = {
    typ: TOKEN_TYP,
    identityId,
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${signScopedPayload("HOST_SESSION_SECRET", TOKEN_TYP, encoded)}`;
}

export function readHostIdentityToken(token: string | undefined): HostIdentitySession | null {
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
    ) as HostIdentitySession;
    if (
      payload.typ !== TOKEN_TYP ||
      typeof payload.identityId !== "string" ||
      !payload.identityId ||
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

export function hostIdentityCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  };
}
