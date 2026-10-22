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
 * On Vercel, a timeout or a firewall error closes (429).
 * `not-found` means the dashboard rule is not published yet. Treating that as
 * a block would reject every guest until the rule exists, so the in-memory
 * layer remains the limit until Yehuda publishes the IDs above.
 * Off Vercel the shared store is skipped; the in-memory layer still runs.
 */
export function sharedLimitDecision(input: {
  onVercel: boolean;
  result?: FirewallCheckResult;
}): LimitDecision {
  if (!input.onVercel) {
    return { ok: true };
  }
  const result = input.result;
  if (!result || result.failed || result.error === "blocked" || result.rateLimited) {
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
