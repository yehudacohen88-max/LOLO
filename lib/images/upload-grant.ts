import "server-only";
import { randomUUID } from "node:crypto";
import { signScopedPayload, signaturesMatch } from "@/lib/security/hmac";

/** Dedicated HMAC secret. Host and invite secrets are not reused. */
export const IMAGE_UPLOAD_SECRET = "IMAGE_UPLOAD_SECRET";

const TOKEN_TYP = "image-upload";
const GRANT_TTL_MS = 2 * 60 * 60 * 1000;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UploadGrant = {
  typ: typeof TOKEN_TYP;
  id: string;
  exp: number;
};

function encodePayload(payload: UploadGrant) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Short-lived capability for the create-event pages, used when the visitor
 * has no host session yet. Returns null when IMAGE_UPLOAD_SECRET is unset
 * so the page still renders; a beta or host session can authorize instead.
 */
export function createImageUploadGrant(now = Date.now()) {
  try {
    const payload: UploadGrant = {
      typ: TOKEN_TYP,
      id: randomUUID(),
      exp: now + GRANT_TTL_MS,
    };
    const encoded = encodePayload(payload);
    return `${encoded}.${signScopedPayload(IMAGE_UPLOAD_SECRET, TOKEN_TYP, encoded)}`;
  } catch {
    return null;
  }
}

export function readImageUploadGrant(token: string | undefined, now = Date.now()) {
  if (!token || token.length > 2000) {
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
    expected = signScopedPayload(IMAGE_UPLOAD_SECRET, TOKEN_TYP, encoded);
  } catch {
    return null;
  }
  if (!signaturesMatch(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as UploadGrant;
    if (
      payload.typ !== TOKEN_TYP ||
      typeof payload.id !== "string" ||
      !UUID.test(payload.id) ||
      typeof payload.exp !== "number" ||
      payload.exp <= now
    ) {
      return null;
    }
    return { id: payload.id };
  } catch {
    return null;
  }
}
