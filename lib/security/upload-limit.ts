import "server-only";

const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 24;
const GLOBAL = 180;

type Counter = {
  count: number;
  resetAt: number;
};

const perIp = new Map<string, Counter>();
let globalCounter: Counter = { count: 0, resetAt: 0 };

function touch(counter: Counter, now: number) {
  if (counter.resetAt <= now) {
    counter.count = 0;
    counter.resetAt = now + WINDOW_MS;
  }
  return counter;
}

function prune(now: number) {
  if (perIp.size < 2000) {
    return;
  }
  for (const [key, counter] of perIp) {
    if (counter.resetAt <= now) {
      perIp.delete(key);
    }
  }
}

export function consumeUpload(ip: string, now = Date.now()) {
  prune(now);
  const ipCounter = touch(perIp.get(ip) ?? { count: 0, resetAt: 0 }, now);
  perIp.set(ip, ipCounter);
  globalCounter = touch(globalCounter, now);

  if (ipCounter.count >= PER_IP || globalCounter.count >= GLOBAL) {
    const until = Math.max(ipCounter.resetAt, globalCounter.resetAt);
    return {
      ok: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((until - now) / 1000)),
    };
  }

  ipCounter.count += 1;
  globalCounter.count += 1;
  return { ok: true as const, retryAfterSeconds: 0 };
}

export function resetUploadLimits() {
  perIp.clear();
  globalCounter = { count: 0, resetAt: 0 };
}
