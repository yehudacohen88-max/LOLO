import { createHash, randomBytes } from "node:crypto";
import { normalizeHostEmail } from "@/lib/host/identity-public";

export const RECOVERY_OTP_TTL_MS = 10 * 60 * 1000;
export const RECOVERY_MAX_ATTEMPTS = 5;
export const RECOVERY_SENDS_PER_HOUR = 3;
export const RECOVERY_IP_PER_HOUR = 10;
export const RECOVERY_ROTATE_COOLDOWN_MS = 60 * 60 * 1000;
export const RECOVERY_MISMATCH = "הפרטים אינם תואמים.";

const MANAGEMENT_CODE = /[A-Z0-9]{4}-[A-Z0-9]{4}/;

export function recoveryStartPayload() {
  return { accepted: true as const };
}

export function recoveryDestinationHash(email: string) {
  return createHash("sha256").update(`lolo-host-email:${email}`).digest("base64url");
}

export function recoveryNoticeBody(otp: string) {
  if (!/^\d{6}$/.test(otp)) {
    throw new Error("קוד האימות אינו תקין.");
  }
  return [
    `קוד חד-פעמי לאימות: ${otp}`,
    "הקוד תקף ל-10 דקות ונועד לשימוש אחד.",
    "לא נשלח קוד ניהול.",
  ].join("\n");
}

export type SimulatedHostNotice = {
  id: string;
  channel: "email";
  destinationHash: string;
  template: "host-recovery-otp";
  body: string;
  createdAt: string;
  simulated: true;
  delivered: false;
};

const outbox: SimulatedHostNotice[] = [];

export function deliverSimulatedHostNotice(input: {
  destinationHash: string;
  body: string;
  now?: string;
}) {
  if (MANAGEMENT_CODE.test(input.body)) {
    throw new Error("הודעת השחזור נחסמה.");
  }
  const notice: SimulatedHostNotice = {
    id: randomBytes(16).toString("base64url"),
    channel: "email",
    destinationHash: input.destinationHash,
    template: "host-recovery-otp",
    body: input.body,
    createdAt: input.now ?? new Date().toISOString(),
    simulated: true,
    delivered: false,
  };
  outbox.push(notice);
  if (outbox.length > 50) {
    outbox.shift();
  }
  return { id: notice.id, simulated: true as const, delivered: false as const };
}

export function readSimulatedHostNotices() {
  return outbox.map((notice) => ({ ...notice }));
}

export function clearSimulatedHostNotices() {
  outbox.length = 0;
}

export function recoverySendDecision(input: {
  emailMatches: boolean;
  recentSends: number;
  rotatedWithinCooldown: boolean;
}) {
  if (!input.emailMatches || input.rotatedWithinCooldown) {
    return "silent" as const;
  }
  if (input.recentSends >= RECOVERY_SENDS_PER_HOUR) {
    return "silent" as const;
  }
  return "send" as const;
}

export type RecoveryChallengeView = {
  id: string;
  otpHash: string;
  expiresAt: string;
  attempts: number;
  consumedAt: string | null;
};

export function planRecoveryConfirm(input: {
  challenge: RecoveryChallengeView | null;
  otpMatches: boolean;
  now: string;
}) {
  const challenge = input.challenge;
  const now = Date.parse(input.now);
  const expires = challenge ? Date.parse(challenge.expiresAt) : Number.NaN;
  const usable =
    Boolean(challenge) &&
    !challenge?.consumedAt &&
    challenge!.attempts < RECOVERY_MAX_ATTEMPTS &&
    Number.isFinite(expires) &&
    expires > now;

  if (!usable || !input.otpMatches) {
    const nextAttempts = usable ? challenge!.attempts + 1 : challenge?.attempts ?? 0;
    return {
      ok: false as const,
      error: RECOVERY_MISMATCH,
      challengeId: usable ? challenge!.id : null,
      nextAttempts,
      burn: usable && nextAttempts >= RECOVERY_MAX_ATTEMPTS,
    };
  }

  return { ok: true as const, challengeId: challenge!.id };
}

export function sameRecoveryEmail(stored: string, given: string) {
  const left = normalizeHostEmail(stored);
  const right = normalizeHostEmail(given);
  return Boolean(left) && left === right;
}

const ipHits = new Map<string, number[]>();

export function noteRecoveryIp(ip: string, now = Date.now()) {
  const windowStart = now - RECOVERY_ROTATE_COOLDOWN_MS;
  const prev = (ipHits.get(ip) ?? []).filter((stamp) => stamp > windowStart);
  if (prev.length >= RECOVERY_IP_PER_HOUR) {
    const retryAfter = Math.max(1, Math.ceil((prev[0] + RECOVERY_ROTATE_COOLDOWN_MS - now) / 1000));
    return { ok: false as const, retryAfter };
  }
  prev.push(now);
  ipHits.set(ip, prev);
  return { ok: true as const };
}

export function clearRecoveryIpLimits() {
  ipHits.clear();
}
