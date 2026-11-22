import "server-only";

/**
 * In-memory upload counters for one server instance.
 *
 * Counters are not shared across instances and reset when a new instance
 * starts. A shared store would need new infrastructure, so it is not wired
 * here. See docs/upload-rate-limit-proposal.md.
 *
 * Callers pass the platform client IP (x-vercel-forwarded-for or x-real-ip),
 * never the first X-Forwarded-For hop, plus a host, beta, or upload-grant id.
 */
const WINDOW_MS = 10 * 60 * 1000;
export const UPLOAD_LIMIT_PER_IP = 24;
export const UPLOAD_LIMIT_PER_PRINCIPAL = 24;
export const UPLOAD_LIMIT_GLOBAL = 180;

type Counter = {
  count: number;
  resetAt: number;
};

const perIp = new Map<string, Counter>();
const perPrincipal = new Map<string, Counter>();
let globalCounter: Counter = { count: 0, resetAt: 0 };

function touch(counter: Counter, now: number) {
  if (counter.resetAt <= now) {
    counter.count = 0;
    counter.resetAt = now + WINDOW_MS;
  }
  return counter;
}

function prune(store: Map<string, Counter>, now: number) {
  if (store.size < 2000) {
    return;
  }
  for (const [key, counter] of store) {
    if (counter.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function consumeUpload(
  identity: { ip: string; principal: string },
  now = Date.now(),
) {
  prune(perIp, now);
  prune(perPrincipal, now);
  const ipCounter = touch(perIp.get(identity.ip) ?? { count: 0, resetAt: 0 }, now);
  const principalCounter = touch(
    perPrincipal.get(identity.principal) ?? { count: 0, resetAt: 0 },
    now,
  );
  perIp.set(identity.ip, ipCounter);
  perPrincipal.set(identity.principal, principalCounter);
  globalCounter = touch(globalCounter, now);

  if (
    ipCounter.count >= UPLOAD_LIMIT_PER_IP ||
    principalCounter.count >= UPLOAD_LIMIT_PER_PRINCIPAL ||
    globalCounter.count >= UPLOAD_LIMIT_GLOBAL
  ) {
    const until = Math.max(ipCounter.resetAt, principalCounter.resetAt, globalCounter.resetAt);
    return {
      ok: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((until - now) / 1000)),
    };
  }

  ipCounter.count += 1;
  principalCounter.count += 1;
  globalCounter.count += 1;
  return { ok: true as const, retryAfterSeconds: 0 };
}

export function resetUploadLimits() {
  perIp.clear();
  perPrincipal.clear();
  globalCounter = { count: 0, resetAt: 0 };
}
