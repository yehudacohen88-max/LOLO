import "server-only";

/**
 * In-memory guest limits, same pattern as login and upload limits.
 * Each server instance keeps its own counters. They reset when that
 * process restarts and are not shared across instances, so a deployment
 * with several instances multiplies the effective budget.
 */

export const GUEST_LIMIT_MESSAGE = "יותר מדי בקשות. נסו שוב מאוחר יותר.";

export const GUEST_LIMITS = {
  readPerIp: 60,
  readWindowMs: 60_000,
  missPerIp: 12,
  missWindowMs: 15 * 60_000,
  missLockMs: 15 * 60_000,
  orderPerIp: 10,
  orderPerSlug: 80,
  orderWindowMs: 15 * 60_000,
  orderReadPerIp: 30,
  orderReadWindowMs: 60_000,
  paymentPerIp: 20,
  paymentPerSlug: 120,
  paymentWindowMs: 15 * 60_000,
  quotePerIp: 30,
  quotePerSlug: 80,
  quoteWindowMs: 15 * 60_000,
} as const;

export type LimitDecision =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

type Counter = {
  count: number;
  resetAt: number;
};

type Miss = {
  failures: number;
  resetAt: number;
  lockedUntil: number;
};

const reads = new Map<string, Counter>();
const misses = new Map<string, Miss>();
const orders = new Map<string, Counter>();
const orderReads = new Map<string, Counter>();
const payments = new Map<string, Counter>();
const quotes = new Map<string, Counter>();

function retryAfter(resetAt: number, now: number) {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

function prune(map: Map<string, Counter>, now: number) {
  if (map.size < 2000) {
    return;
  }
  for (const [key, counter] of map) {
    if (counter.resetAt <= now) {
      map.delete(key);
    }
  }
}

function take(
  map: Map<string, Counter>,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): LimitDecision {
  prune(map, now);
  let counter = map.get(key);
  if (!counter || counter.resetAt <= now) {
    counter = { count: 0, resetAt: now + windowMs };
    map.set(key, counter);
  }
  if (counter.count >= limit) {
    return { ok: false, retryAfterSeconds: retryAfter(counter.resetAt, now) };
  }
  counter.count += 1;
  return { ok: true };
}

function slugKey(slug: string) {
  return slug.slice(0, 80);
}

export function guestMissLocked(ip: string, now = Date.now()): LimitDecision {
  const entry = misses.get(ip);
  if (!entry || entry.lockedUntil <= now) {
    return { ok: true };
  }
  return { ok: false, retryAfterSeconds: retryAfter(entry.lockedUntil, now) };
}

export function noteGuestMiss(ip: string, now = Date.now()) {
  if (misses.size >= 2000) {
    for (const [key, entry] of misses) {
      if (entry.lockedUntil <= now && entry.resetAt <= now) {
        misses.delete(key);
      }
    }
  }
  let entry = misses.get(ip);
  if (!entry || (entry.lockedUntil <= now && entry.resetAt <= now)) {
    entry = { failures: 0, resetAt: now + GUEST_LIMITS.missWindowMs, lockedUntil: 0 };
    misses.set(ip, entry);
  }
  entry.failures += 1;
  if (entry.failures >= GUEST_LIMITS.missPerIp) {
    entry.lockedUntil = now + GUEST_LIMITS.missLockMs;
  }
}

export function beginGuestRead(ip: string, now = Date.now()): LimitDecision {
  const locked = guestMissLocked(ip, now);
  if (!locked.ok) {
    return locked;
  }
  return take(reads, ip, GUEST_LIMITS.readPerIp, GUEST_LIMITS.readWindowMs, now);
}

export function takeOrderWrite(ip: string, slug: string, now = Date.now()): LimitDecision {
  const ipDecision = take(
    orders,
    `ip:${ip}`,
    GUEST_LIMITS.orderPerIp,
    GUEST_LIMITS.orderWindowMs,
    now,
  );
  if (!ipDecision.ok) {
    return ipDecision;
  }
  return take(
    orders,
    `slug:${slugKey(slug)}`,
    GUEST_LIMITS.orderPerSlug,
    GUEST_LIMITS.orderWindowMs,
    now,
  );
}

export function takeOrderRead(ip: string, now = Date.now()): LimitDecision {
  return take(
    orderReads,
    ip,
    GUEST_LIMITS.orderReadPerIp,
    GUEST_LIMITS.orderReadWindowMs,
    now,
  );
}

export function takePaymentIp(ip: string, now = Date.now()): LimitDecision {
  return take(
    payments,
    `ip:${ip}`,
    GUEST_LIMITS.paymentPerIp,
    GUEST_LIMITS.paymentWindowMs,
    now,
  );
}

export function takePaymentSlug(slug: string, now = Date.now()): LimitDecision {
  return take(
    payments,
    `slug:${slugKey(slug)}`,
    GUEST_LIMITS.paymentPerSlug,
    GUEST_LIMITS.paymentWindowMs,
    now,
  );
}

export function takeQuote(ip: string, slug: string, now = Date.now()): LimitDecision {
  const ipDecision = take(
    quotes,
    `ip:${ip}`,
    GUEST_LIMITS.quotePerIp,
    GUEST_LIMITS.quoteWindowMs,
    now,
  );
  if (!ipDecision.ok) {
    return ipDecision;
  }
  return take(
    quotes,
    `slug:${slugKey(slug)}`,
    GUEST_LIMITS.quotePerSlug,
    GUEST_LIMITS.quoteWindowMs,
    now,
  );
}

export function resetGuestLimits() {
  reads.clear();
  misses.clear();
  orders.clear();
  orderReads.clear();
  payments.clear();
  quotes.clear();
}
