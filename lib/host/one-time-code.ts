import "server-only";
import { pbkdf2, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 210_000;
const KEY_LENGTH = 32;

function parseHash(stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") {
    return null;
  }
  try {
    const salt = Buffer.from(parts[3], "base64url");
    const hash = Buffer.from(parts[4], "base64url");
    const iterations = Number(parts[2]);
    if (!salt.length || !hash.length || !Number.isFinite(iterations)) {
      return null;
    }
    return { iterations, salt, hash };
  } catch {
    return null;
  }
}

export function generateRecoveryOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function hashOneTimeCode(code: string) {
  const salt = randomBytes(16);
  const derived = (await pbkdf2Async(
    code.trim(),
    salt,
    ITERATIONS,
    KEY_LENGTH,
    "sha256",
  )) as Buffer;
  return `pbkdf2$sha256$${ITERATIONS}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function oneTimeCodeMatches(code: string, storedHash: string) {
  const parsed = parseHash(storedHash);
  if (!parsed) {
    return false;
  }
  const derived = (await pbkdf2Async(
    code.trim(),
    parsed.salt,
    parsed.iterations,
    parsed.hash.length,
    "sha256",
  )) as Buffer;
  if (derived.length !== parsed.hash.length) {
    return false;
  }
  return timingSafeEqual(derived, parsed.hash);
}
