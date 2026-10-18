export const BETA_SESSION_COOKIE = "lolo_beta_session";
export const BETA_ATTEMPT_COOKIE = "lolo_beta_attempts";

export const BETA_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const BETA_ATTEMPT_LIMIT = 5;
export const BETA_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const BETA_LOCK_MS = 15 * 60 * 1000;

const DISABLED = new Set(["false", "0", "off", "no"]);

export type BetaGateMode = "open" | "ready" | "misconfigured";

export type BetaAttemptState = {
  ip: string;
  failures: number;
  resetAt: number;
  lockedUntil: number;
};

type BetaSession = {
  typ: "beta";
  exp: number;
};

function encodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBytes(value: string) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + pad);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return encodeBytes(new Uint8Array(signature));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return encodeBytes(new Uint8Array(digest));
}

export function betaGateMode(input: {
  enabled?: string;
  password?: string;
  secret?: string;
}): BetaGateMode {
  const flag = (input.enabled ?? "").trim().toLowerCase();
  if (DISABLED.has(flag)) {
    return "open";
  }
  if (!(input.password ?? "").trim() || !(input.secret ?? "").trim()) {
    return "misconfigured";
  }
  return "ready";
}

export function betaGateModeFromEnv(): BetaGateMode {
  return betaGateMode({
    enabled: process.env.BETA_ACCESS_ENABLED,
    password: process.env.BETA_ACCESS_PASSWORD,
    secret: process.env.BETA_ACCESS_SECRET,
  });
}

export function safeNextPath(value: string | null | undefined) {
  if (!value) {
    return "/";
  }
  let path = value.trim();
  if (!path || path.length > 2000) {
    return "/";
  }
  try {
    path = decodeURIComponent(path);
  } catch {
    return "/";
  }
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\") ||
    path.includes("\\") ||
    path.includes("://") ||
    path.includes("\0")
  ) {
    return "/";
  }
  return path;
}

export function clientIpFromHeaders(headerStore: { get(name: string): string | null }) {
  const forwarded = headerStore.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) {
    return first.slice(0, 128);
  }
  const realIp = headerStore.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp.slice(0, 128);
  }
  return "unknown";
}

export async function betaPasswordMatches(input: string, expected: string) {
  if (!expected.trim() || !input || input.length > 200) {
    return false;
  }
  const given = await sha256(input);
  const good = await sha256(expected.trim());
  return safeEqual(given, good);
}

export async function createBetaSessionValue(secret: string, now = Date.now()) {
  const payload: BetaSession = { typ: "beta", exp: now + BETA_SESSION_MS };
  const encoded = encodeBytes(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmac(secret, `beta:${encoded}`);
  return `${encoded}.${signature}`;
}

export async function readBetaSessionValue(
  secret: string,
  token: string | undefined,
  now = Date.now(),
) {
  if (!secret || !token) {
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
  const expected = await hmac(secret, `beta:${encoded}`);
  if (!safeEqual(signature, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeBytes(encoded))) as Partial<BetaSession>;
    if (payload.typ !== "beta" || typeof payload.exp !== "number" || payload.exp <= now) {
      return null;
    }
    return { typ: "beta" as const, exp: payload.exp };
  } catch {
    return null;
  }
}

async function packAttempt(secret: string, state: BetaAttemptState) {
  const encoded = encodeBytes(new TextEncoder().encode(JSON.stringify(state)));
  const signature = await hmac(secret, `beta-attempt:${encoded}`);
  return `${encoded}.${signature}`;
}

export async function readBetaAttemptValue(
  secret: string,
  token: string | undefined,
  ip: string,
  now = Date.now(),
): Promise<BetaAttemptState | null> {
  if (!secret || !token) {
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
  const expected = await hmac(secret, `beta-attempt:${encoded}`);
  if (!safeEqual(signature, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBytes(encoded)),
    ) as Partial<BetaAttemptState>;
    if (
      payload.ip !== ip ||
      typeof payload.failures !== "number" ||
      typeof payload.resetAt !== "number" ||
      typeof payload.lockedUntil !== "number"
    ) {
      return null;
    }
    if (payload.resetAt <= now && payload.lockedUntil <= now) {
      return null;
    }
    return {
      ip,
      failures: payload.failures,
      resetAt: payload.resetAt,
      lockedUntil: payload.lockedUntil,
    };
  } catch {
    return null;
  }
}

export function betaAttemptLocked(state: BetaAttemptState | null, now = Date.now()) {
  return Boolean(state && state.lockedUntil > now);
}

export async function nextBetaAttemptValue(
  secret: string,
  current: BetaAttemptState | null,
  ip: string,
  now = Date.now(),
) {
  const fresh = !current || current.resetAt <= now;
  const failures = (fresh ? 0 : current.failures) + 1;
  const state: BetaAttemptState = {
    ip,
    failures,
    resetAt: fresh ? now + BETA_ATTEMPT_WINDOW_MS : current.resetAt,
    lockedUntil: failures >= BETA_ATTEMPT_LIMIT ? now + BETA_LOCK_MS : 0,
  };
  return {
    state,
    token: await packAttempt(secret, state),
  };
}

export function betaCookieOptions(maxAge: number, nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: nodeEnv === "production",
    path: "/",
    maxAge,
  };
}
