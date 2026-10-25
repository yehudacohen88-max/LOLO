/** Must match the @vercel/firewall rate-limit IDs Yehuda publishes. Not created here. */
export const GUEST_RATE_LIMIT_IDS = {
  read: "lolo-guest-read",
  write: "lolo-guest-write",
} as const;

export const SHARED_LIMIT_TIMEOUT_MS = 1000;
export const SHARED_LIMIT_RETRY_AFTER_SECONDS = 60;

export const GUEST_EVENT_MISS = { error: "האירוע לא נמצא." } as const;
export const GUEST_ORDER_MISS = { error: "ההזמנה לא נמצאה." } as const;

export type SharedLimitScope = "read" | "write";

export type LimitDecision =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export type FirewallCheckResult = {
  rateLimited?: boolean;
  error?: "not-found" | "blocked";
  failed?: boolean;
};

/**
 * On Vercel, only `rateLimited: true` closes (429). That includes a firewall
 * `blocked` result, which the SDK reports with `rateLimited: true`.
 * A timeout, throw, missing result, or `not-found` (rule not published) falls
 * through. The in-memory layer still runs either way.
 * Off Vercel the shared store is skipped; the in-memory layer still runs.
 */
export function sharedLimitDecision(input: {
  onVercel: boolean;
  result?: FirewallCheckResult;
}): LimitDecision {
  if (input.onVercel && input.result?.rateLimited) {
    return { ok: false, retryAfterSeconds: SHARED_LIMIT_RETRY_AFTER_SECONDS };
  }
  return { ok: true };
}

export function guestRateLimitKey(ip: string, scope: SharedLimitScope, eventId?: string) {
  if (scope === "read") {
    return ip;
  }
  return `${ip}:${eventId || "none"}`;
}

/**
 * Missing, malformed, and not-public slugs share one body and status.
 * `visible` is false when a stored row must not be shown to a guest.
 */
export function guestEventLookup(input: {
  slug: string;
  found: boolean;
  visible: boolean;
}) {
  const slug = input.slug.trim().toLowerCase();
  const publicShape = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(slug);
  if (!publicShape || !input.found || !input.visible) {
    return { status: 404 as const, body: GUEST_EVENT_MISS };
  }
  return { status: 200 as const, body: null };
}
