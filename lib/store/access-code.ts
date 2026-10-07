import "server-only";
import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ITERATIONS = 210000;
const KEY_LENGTH = 32;
const DUMMY_HASH = `pbkdf2$sha256$210000$${Buffer.alloc(16).toString("base64url")}$${Buffer.alloc(32).toString("base64url")}`;

function randomCodeChars(length: number) {
  const chars: string[] = [];
  const bytes = randomBytes(length);
  for (let index = 0; index < length; index += 1) {
    chars.push(ALPHABET[bytes[index] % ALPHABET.length]);
  }
  return chars.join("");
}

export function generateStoreAccessCode() {
  const raw = randomCodeChars(12);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

export function normalizeStoreAccessCode(code: string) {
  const raw = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return raw.replace(/(.{4})(?=.)/g, "$1-");
}

export async function hashStoreAccessCode(code: string) {
  const normalized = normalizeStoreAccessCode(code);
  const salt = randomBytes(16);
  const derived = (await pbkdf2Async(
    normalized,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    "sha256",
  )) as Buffer;
  return `pbkdf2$sha256$${ITERATIONS}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

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

export async function storeAccessCodeMatches(code: string, storedHash: string) {
  const parsed = parseHash(storedHash || DUMMY_HASH) ?? parseHash(DUMMY_HASH);
  if (!parsed) {
    return false;
  }

  const normalized = normalizeStoreAccessCode(code);
  const derived = (await pbkdf2Async(
    normalized,
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
