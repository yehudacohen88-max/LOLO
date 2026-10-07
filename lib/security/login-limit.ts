import "server-only";

type Bucket = {
  failures: number;
  resetAt: number;
  lockedUntil: number;
};

type Policy = {
  perIp: number;
  global: number | null;
  windowMs: number;
  lockMs: number;
};

export const LOGIN_LIMIT_MESSAGE = "יותר מדי ניסיונות. נסו שוב מאוחר יותר.";

export const LOGIN_POLICIES = {
  admin: {
    perIp: 5,
    global: 40,
    windowMs: 15 * 60 * 1000,
    lockMs: 15 * 60 * 1000,
  },
  host: {
    perIp: 10,
    global: null,
    windowMs: 15 * 60 * 1000,
    lockMs: 15 * 60 * 1000,
  },
} as const satisfies Record<string, Policy>;

export type LoginScope = keyof typeof LOGIN_POLICIES;

const buckets = new Map<string, Bucket>();

function ipKey(scope: LoginScope, ip: string) {
  return `${scope}:ip:${ip}`;
}

function globalKey(scope: LoginScope) {
  return `${scope}:global`;
}

export function clientIpFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) {
    return first.slice(0, 128);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp.slice(0, 128);
  }
  return "unknown";
}

function bucket(key: string, now: number, windowMs: number) {
  const current = buckets.get(key);
  if (!current) {
    const created: Bucket = { failures: 0, resetAt: now + windowMs, lockedUntil: 0 };
    buckets.set(key, created);
    return created;
  }
  if (current.lockedUntil > now) {
    return current;
  }
  if (current.resetAt <= now || current.lockedUntil > 0) {
    current.failures = 0;
    current.lockedUntil = 0;
    current.resetAt = now + windowMs;
  }
  return current;
}

function lockedUntil(scope: LoginScope, ip: string, now: number) {
  const policy = LOGIN_POLICIES[scope];
  const times = [buckets.get(ipKey(scope, ip))?.lockedUntil ?? 0];
  if (policy.global) {
    times.push(buckets.get(globalKey(scope))?.lockedUntil ?? 0);
  }
  const until = Math.max(...times);
  return until > now ? until : 0;
}

export function loginAttemptAllowed(scope: LoginScope, ip: string, now = Date.now()) {
  return lockedUntil(scope, ip, now) === 0;
}

export function loginRetryAfterSeconds(scope: LoginScope, ip: string, now = Date.now()) {
  const until = lockedUntil(scope, ip, now);
  if (!until) {
    return 0;
  }
  return Math.max(1, Math.ceil((until - now) / 1000));
}

function prune(now: number) {
  if (buckets.size < 2000) {
    return;
  }
  for (const [key, entry] of buckets) {
    if (entry.lockedUntil <= now && entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function recordLoginFailure(scope: LoginScope, ip: string, now = Date.now()) {
  prune(now);
  const policy = LOGIN_POLICIES[scope];
  const ipBucket = bucket(ipKey(scope, ip), now, policy.windowMs);
  ipBucket.failures += 1;
  if (ipBucket.failures >= policy.perIp) {
    ipBucket.lockedUntil = now + policy.lockMs;
  }
  if (policy.global) {
    const globalBucket = bucket(globalKey(scope), now, policy.windowMs);
    globalBucket.failures += 1;
    if (globalBucket.failures >= policy.global) {
      globalBucket.lockedUntil = now + policy.lockMs;
    }
  }
}

export function clearLoginFailures(scope: LoginScope, ip: string) {
  buckets.delete(ipKey(scope, ip));
}

export function resetLoginLimits() {
  buckets.clear();
}
