import "server-only";
import { checkRateLimit } from "@vercel/firewall";
import { SHARED_LIMIT_RETRY_AFTER_SECONDS, SHARED_LIMIT_TIMEOUT_MS } from "@/lib/security/guest-rate-decision";

/**
 * Firewall rule id. Not published in this repo. Until Yehuda creates
 * `lolo-image-upload` in the Vercel Firewall, checkRateLimit returns
 * not-found and this decision stays open. The in-memory limiter still runs.
 */
export const UPLOAD_SHARED_RATE_LIMIT_ID = "lolo-image-upload";

export type UploadSharedDecision =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

type Check = typeof checkRateLimit;

/**
 * Shared cap keyed only by the trusted IP, so a new upload grant does not
 * open a new shared bucket. A missing rule, timeout, or throw fails open.
 * The caller still applies the in-memory limiter.
 */
export async function decideUploadSharedLimit(
  input: {
    ip: string;
    request?: Request;
    onVercel?: boolean;
    check?: Check;
  },
): Promise<UploadSharedDecision> {
  const onVercel = input.onVercel ?? process.env.VERCEL === "1";
  if (!onVercel) {
    return { ok: true };
  }
  const check = input.check ?? checkRateLimit;
  try {
    const result = await check(UPLOAD_SHARED_RATE_LIMIT_ID, {
      request: input.request,
      headers: input.request?.headers,
      rateLimitKey: input.ip,
      timeout: SHARED_LIMIT_TIMEOUT_MS,
    });
    if (result.rateLimited) {
      console.warn("[LOLO] upload shared limit", {
        id: UPLOAD_SHARED_RATE_LIMIT_ID,
        code: result.error === "blocked" ? "blocked" : "rate-limited",
      });
      return { ok: false, retryAfterSeconds: SHARED_LIMIT_RETRY_AFTER_SECONDS };
    }
    return { ok: true };
  } catch (error) {
    const code = error instanceof Error ? error.name : "failed";
    console.warn("[LOLO] upload shared limit", { id: UPLOAD_SHARED_RATE_LIMIT_ID, code });
    return { ok: true };
  }
}
