import "server-only";
import { randomUUID } from "node:crypto";
import { signScopedPayload, signaturesMatch } from "@/lib/security/hmac";

/** Dedicated HMAC secret. Host and invite secrets are not reused. */
export const IMAGE_UPLOAD_SECRET = "IMAGE_UPLOAD_SECRET";

const TOKEN_TYP = "image-upload";
/** Long enough to finish creating an event, short enough that a stolen grant dies quickly. */
export const UPLOAD_GRANT_TTL_MS = 30 * 60 * 1000;
/** Mint cap per trusted IP. Uploads stay capped separately and are not multiplied by this. */
export const UPLOAD_GRANT_ISSUE_LIMIT = 300;
const ISSUE_WINDOW_MS = 10 * 60 * 1000;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UploadGrant = {
  typ: typeof TOKEN_TYP;
  id: string;
  ip: string;
  exp: number;
};

type IssueCounter = {
  count: number;
  resetAt: number;
};

const issued = new Map<string, IssueCounter>();

function encodePayload(payload: UploadGrant) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function normalizeGrantIp(ip: string) {
  const value = ip.trim();
  if (!value || value.length > 128 || /[\s,]/.test(value)) {
    return "unknown";
  }
  return value;
}

function allowIssue(ip: string, now: number) {
  if (issued.size > 2000) {
    for (const [key, counter] of issued) {
      if (counter.resetAt <= now) {
        issued.delete(key);
      }
    }
  }
  const current = issued.get(ip);
  if (!current || current.resetAt <= now) {
    issued.set(ip, { count: 1, resetAt: now + ISSUE_WINDOW_MS });
    return true;
  }
  if (current.count >= UPLOAD_GRANT_ISSUE_LIMIT) {
    return false;
  }
  current.count += 1;
  return true;
}

/**
 * Short-lived capability for the create-event pages, bound to the trusted IP
 * that rendered the page. Returns null when IMAGE_UPLOAD_SECRET is unset or
 * this IP has already minted UPLOAD_GRANT_ISSUE_LIMIT grants in the window.
 * The page still renders; a beta or host session can authorize instead.
 */
export function createImageUploadGrant(ip: string, now = Date.now()) {
  const boundIp = normalizeGrantIp(ip);
  if (!allowIssue(boundIp, now)) {
    return null;
  }
  try {
    const payload: UploadGrant = {
      typ: TOKEN_TYP,
      id: randomUUID(),
      ip: boundIp,
      exp: now + UPLOAD_GRANT_TTL_MS,
    };
    const encoded = encodePayload(payload);
    return `${encoded}.${signScopedPayload(IMAGE_UPLOAD_SECRET, TOKEN_TYP, encoded)}`;
  } catch {
    return null;
  }
}

export function readImageUploadGrant(token: string | undefined, ip: string, now = Date.now()) {
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
    const boundIp = normalizeGrantIp(ip);
    if (
      payload.typ !== TOKEN_TYP ||
      typeof payload.id !== "string" ||
      !UUID.test(payload.id) ||
      typeof payload.ip !== "string" ||
      payload.ip !== boundIp ||
      typeof payload.exp !== "number" ||
      payload.exp <= now
    ) {
      return null;
    }
    return { id: payload.id, ip: boundIp };
  } catch {
    return null;
  }
}

export function resetUploadGrantIssuance() {
  issued.clear();
}
