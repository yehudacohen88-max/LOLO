import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export function inviteTokenPath(token: string) {
  return `/i/${encodeURIComponent(token)}`;
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

function inviteSecret() {
  return (
    process.env.INVITE_TOKEN_SECRET ||
    process.env.HOST_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function inviteKey() {
  const secret = inviteSecret();
  if (!secret) {
    throw new Error("חסר מפתח שרת של Supabase.");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function generateInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function encryptInviteToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", inviteKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptInviteToken(stored: string) {
  const [ivPart, tagPart, dataPart] = stored.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      inviteKey(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
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
