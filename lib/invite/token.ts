import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { readRequiredEnv } from "@/lib/security/required-secret";

export function inviteTokenPath(token: string) {
  return `/i/${encodeURIComponent(token)}`;
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

function aesKey(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest();
}

function encryptWithKey(token: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptWithKey(stored: string, key: Buffer) {
  const [ivPart, tagPart, dataPart] = stored.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]);
    const text = decrypted.toString("utf8");
    return text || null;
  } catch {
    return null;
  }
}

function legacyHostSecret() {
  const legacy = process.env.HOST_SESSION_SECRET?.trim() ?? "";
  const primary = process.env.INVITE_TOKEN_SECRET?.trim() ?? "";
  if (!legacy || legacy === primary) {
    return "";
  }
  return legacy;
}

export function generateInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function encryptInviteToken(token: string) {
  return encryptWithKey(token, aesKey(readRequiredEnv("INVITE_TOKEN_SECRET")));
}

export function decryptInviteToken(stored: string) {
  const primary = decryptWithKey(stored, aesKey(readRequiredEnv("INVITE_TOKEN_SECRET")));
  if (primary) {
    return primary;
  }

  // Rows encrypted before INVITE_TOKEN_SECRET was required may have used
  // HOST_SESSION_SECRET. Never try SUPABASE_SERVICE_ROLE_KEY.
  const legacy = legacyHostSecret();
  if (!legacy) {
    return null;
  }
  return decryptWithKey(stored, aesKey(legacy));
}

export function createInviteCredentials() {
  const token = generateInviteToken();
  return {
    token,
    hash: hashInviteToken(token),
    enc: encryptInviteToken(token),
    path: inviteTokenPath(token),
  };
}
