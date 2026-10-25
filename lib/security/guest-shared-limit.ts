import "server-only";
import { checkRateLimit } from "@vercel/firewall";
import {
  GUEST_RATE_LIMIT_IDS,
  SHARED_LIMIT_TIMEOUT_MS,
  guestRateLimitKey,
  sharedLimitDecision,
  type FirewallCheckResult,
  type SharedLimitScope,
} from "@/lib/security/guest-rate-decision";

type HeaderLike = Headers | Record<string, string>;

export type SharedRateLimiter = {
  consume(input: {
    scope: SharedLimitScope;
    ip: string;
    eventId?: string;
    request?: Request;
    headers?: HeaderLike;
  }): Promise<ReturnType<typeof sharedLimitDecision>>;
};

function onVercel() {
  return process.env.VERCEL === "1";
}

function sharedLimitProblemCode(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "timeout";
    }
    const status = /response status '[^']*': (\d+)/.exec(error.message);
    if (status?.[1]) {
      return `http-${status[1]}`;
    }
  }
  return "failed";
}

function warnSharedLimit(id: string, code: string) {
  console.warn("[LOLO] guest shared limit", { id, code });
}

async function firewallResult(
  id: string,
  key: string,
  input: { request?: Request; headers?: HeaderLike },
): Promise<FirewallCheckResult> {
  try {
    const result = await checkRateLimit(id, {
      request: input.request,
      headers: input.headers,
      rateLimitKey: key,
      timeout: SHARED_LIMIT_TIMEOUT_MS,
    });
    if (result.rateLimited) {
      warnSharedLimit(id, result.error === "blocked" ? "blocked" : "rate-limited");
    }
    return { rateLimited: result.rateLimited, error: result.error };
  } catch (error) {
    const code = sharedLimitProblemCode(error);
    warnSharedLimit(id, code);
    return { failed: true };
  }
}

export const vercelSharedRateLimiter: SharedRateLimiter = {
  async consume(input) {
    if (!onVercel()) {
      return sharedLimitDecision({ onVercel: false });
    }
    const id = input.scope === "write" ? GUEST_RATE_LIMIT_IDS.write : GUEST_RATE_LIMIT_IDS.read;
    const key = guestRateLimitKey(input.ip, input.scope, input.eventId);
    const result = await firewallResult(id, key, input);
    return sharedLimitDecision({ onVercel: true, result });
  },
};

export async function consumeGuestSharedLimit(
  input: Parameters<SharedRateLimiter["consume"]>[0],
  limiter: SharedRateLimiter = vercelSharedRateLimiter,
) {
  return limiter.consume(input);
}
