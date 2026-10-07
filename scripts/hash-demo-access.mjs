import { pbkdf2, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 210000;
const KEY_LENGTH = 32;

function normalizeHost(code) {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^(.{4})(.+)$/, "$1-$2");
}

function normalizeStore(code) {
  const raw = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return raw.replace(/(.{4})(?=.)/g, "$1-");
}

function parseHash(stored) {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") {
    throw new Error("Hash format does not match the app.");
  }
  return {
    iterations: Number(parts[2]),
    salt: Buffer.from(parts[3], "base64url"),
    hash: Buffer.from(parts[4], "base64url"),
  };
}

async function matches(code, stored) {
  const parsed = parseHash(stored);
  const derived = await pbkdf2Async(
    code,
    parsed.salt,
    parsed.iterations,
    parsed.hash.length,
    "sha256",
  );
  return (
    derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash)
  );
}

const hostCode = "DEMO-LOLO";
const storeCode = "DEMO-SHOP-CODE";
const seed = readFileSync(new URL("../supabase/demo-seed.sql", import.meta.url), "utf8");
const hashes = [...seed.matchAll(/pbkdf2\$sha256\$210000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+/g)].map(
  (match) => match[0],
);

if (hashes.length < 2) {
  throw new Error("demo-seed.sql is missing the host and store hashes.");
}

const hostOk = await matches(normalizeHost(hostCode), hashes[0]);
const storeOk = await matches(normalizeStore(storeCode), hashes[1]);

if (!hostOk || !storeOk) {
  throw new Error("Demo access hashes do not match the documented codes.");
}

console.log(`Host code ${normalizeHost(hostCode)} matches the seed hash.`);
console.log(`Store code ${normalizeStore(storeCode)} matches the seed hash.`);
console.log(`PBKDF2 sha256, ${ITERATIONS} iterations, ${KEY_LENGTH} bytes.`);
