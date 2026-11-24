import "server-only";
import { generateHostAccessCode, hashHostAccessCode } from "@/lib/host/access-code";
import { normalizeHostEmail } from "@/lib/host/identity-public";
import {
  generateRecoveryOtp,
  hashOneTimeCode,
  oneTimeCodeMatches,
} from "@/lib/host/one-time-code";
import {
  planRecoveryConfirm,
  RECOVERY_MISMATCH,
  RECOVERY_OTP_TTL_MS,
  RECOVERY_ROTATE_COOLDOWN_MS,
  RECOVERY_SENDS_PER_HOUR,
  recoveryDestinationHash,
  recoveryNoticeBody,
  recoverySendDecision,
  recoveryStartPayload,
  deliverSimulatedHostNotice,
  sameRecoveryEmail,
  type RecoveryChallengeView,
} from "@/lib/host/recovery-flow";
import { hostSchemaUnavailable, isMissingColumn, isMissingRelation } from "@/lib/host/schema-error";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

async function releaseChallenge(challengeId: string) {
  const supabase = getSupabaseServiceClient();
  await supabase
    .from("host_recovery_challenges")
    .update({ consumed_at: null })
    .eq("id", challengeId);
}

async function assertRecoverySchema() {
  const supabase = getSupabaseServiceClient();
  const probe = await supabase.from("host_recovery_challenges").select("id").limit(1);
  if (probe.error) {
    if (
      isMissingRelation(probe.error, "host_recovery_challenges") ||
      isMissingColumn(probe.error, "otp_hash")
    ) {
      throw hostSchemaUnavailable();
    }
    throw hostSchemaUnavailable();
  }
}

export async function startHostRecovery(input: { slug: string; email: string }) {
  await assertRecoverySchema();
  const payload = recoveryStartPayload();
  const email = normalizeHostEmail(input.email);
  const slug = input.slug.trim();
  if (!email || !slug) {
    return payload;
  }

  const supabase = getSupabaseServiceClient();
  const event = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
  if (event.error || !event.data?.id) {
    return payload;
  }
  const eventId = String(event.data.id);
  const link = await supabase
    .from("host_identity_events")
    .select("host_identity_id")
    .eq("event_id", eventId)
    .limit(1);
  if (link.error) {
    throw hostSchemaUnavailable();
  }
  const identityId = link.data?.[0]?.host_identity_id
    ? String(link.data[0].host_identity_id)
    : "";
  let storedEmail = "";
  if (identityId) {
    const identity = await supabase
      .from("host_identities")
      .select("email")
      .eq("id", identityId)
      .maybeSingle();
    if (identity.error) {
      throw hostSchemaUnavailable();
    }
    storedEmail = String(identity.data?.email || "");
  }

  const matches = sameRecoveryEmail(storedEmail, email);
  const destinationHash = recoveryDestinationHash(email);
  const since = new Date(Date.now() - RECOVERY_ROTATE_COOLDOWN_MS).toISOString();
  const recent = matches
    ? await supabase
        .from("host_recovery_challenges")
        .select("id")
        .eq("destination_hash", destinationHash)
        .gte("created_at", since)
    : { data: [], error: null };
  if (recent.error) {
    throw hostSchemaUnavailable();
  }
  const rotated = matches
    ? await supabase
        .from("host_recovery_challenges")
        .select("id")
        .eq("event_id", eventId)
        .gte("consumed_at", since)
    : { data: [], error: null };
  if (rotated.error) {
    throw hostSchemaUnavailable();
  }

  const decision = recoverySendDecision({
    emailMatches: matches,
    recentSends: recent.data?.length ?? 0,
    rotatedWithinCooldown: (rotated.data?.length ?? 0) > 0,
  });
  if (decision !== "send" || !identityId) {
    return payload;
  }
  if ((recent.data?.length ?? 0) >= RECOVERY_SENDS_PER_HOUR) {
    return payload;
  }

  const otp = generateRecoveryOtp();
  const body = recoveryNoticeBody(otp);
  const otpHash = await hashOneTimeCode(otp);
  const inserted = await supabase.from("host_recovery_challenges").insert({
    event_id: eventId,
    host_identity_id: identityId,
    channel: "email",
    destination_hash: destinationHash,
    otp_hash: otpHash,
    expires_at: new Date(Date.now() + RECOVERY_OTP_TTL_MS).toISOString(),
    attempts: 0,
  });
  if (inserted.error) {
    throw hostSchemaUnavailable();
  }
  deliverSimulatedHostNotice({ destinationHash, body });
  return payload;
}

export async function confirmHostRecovery(input: {
  slug: string;
  email: string;
  otp: string;
}) {
  await assertRecoverySchema();
  const email = normalizeHostEmail(input.email);
  const slug = input.slug.trim();
  const otp = input.otp.trim();
  if (!email || !slug || !/^\d{6}$/.test(otp)) {
    return { ok: false as const, error: RECOVERY_MISMATCH };
  }

  const supabase = getSupabaseServiceClient();
  const event = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
  if (event.error) {
    throw hostSchemaUnavailable();
  }
  const eventId = event.data?.id ? String(event.data.id) : "";
  const destinationHash = recoveryDestinationHash(email);
  const challengeResult = eventId
    ? await supabase
        .from("host_recovery_challenges")
        .select("id, otp_hash, expires_at, attempts, consumed_at, host_identity_id, destination_hash")
        .eq("event_id", eventId)
        .eq("destination_hash", destinationHash)
        .order("created_at", { ascending: false })
        .limit(1)
    : { data: [], error: null };
  if (challengeResult.error) {
    throw hostSchemaUnavailable();
  }
  const row = challengeResult.data?.[0];
  const challenge: RecoveryChallengeView | null = row
    ? {
        id: String(row.id),
        otpHash: String(row.otp_hash),
        expiresAt: String(row.expires_at),
        attempts: Number(row.attempts) || 0,
        consumedAt: row.consumed_at ? String(row.consumed_at) : null,
      }
    : null;
  const otpMatches = challenge ? await oneTimeCodeMatches(otp, challenge.otpHash) : false;
  const decision = planRecoveryConfirm({
    challenge,
    otpMatches,
    now: new Date().toISOString(),
  });
  if (!decision.ok) {
    if (decision.challengeId) {
      await supabase
        .from("host_recovery_challenges")
        .update({
          attempts: decision.nextAttempts,
          consumed_at: decision.burn ? new Date().toISOString() : null,
        })
        .eq("id", decision.challengeId)
        .is("consumed_at", null);
    }
    return { ok: false as const, error: decision.error };
  }

  const consumedAt = new Date().toISOString();
  const consumed = await supabase
    .from("host_recovery_challenges")
    .update({ consumed_at: consumedAt })
    .eq("id", decision.challengeId)
    .is("consumed_at", null)
    .select("id, host_identity_id")
    .maybeSingle();
  if (consumed.error || !consumed.data?.id) {
    return { ok: false as const, error: RECOVERY_MISMATCH };
  }

  const access = await supabase
    .from("event_host_access")
    .select("session_version")
    .eq("event_id", eventId)
    .maybeSingle();
  if (access.error && !isMissingColumn(access.error, "session_version")) {
    await releaseChallenge(decision.challengeId);
    throw hostSchemaUnavailable();
  }
  if (access.error || access.data?.session_version == null) {
    await releaseChallenge(decision.challengeId);
    throw hostSchemaUnavailable();
  }
  const current = Number(access.data.session_version);
  if (!Number.isInteger(current) || current < 0) {
    await releaseChallenge(decision.challengeId);
    throw hostSchemaUnavailable();
  }

  const accessCode = generateHostAccessCode();
  const codeHash = await hashHostAccessCode(accessCode);
  const rotated = await supabase
    .from("event_host_access")
    .update({ code_hash: codeHash, session_version: current + 1 })
    .eq("event_id", eventId)
    .eq("session_version", current)
    .select("session_version")
    .maybeSingle();
  if (rotated.error || !rotated.data) {
    await releaseChallenge(decision.challengeId);
    throw hostSchemaUnavailable();
  }

  const identityId = String(consumed.data.host_identity_id || row?.host_identity_id || "");
  if (identityId) {
    await supabase
      .from("host_identities")
      .update({ email_verified_at: new Date().toISOString() })
      .eq("id", identityId)
      .is("email_verified_at", null);
  }

  return { ok: true as const, accessCode, eventId, identityId };
}
