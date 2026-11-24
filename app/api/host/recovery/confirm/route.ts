import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { slugFromHostIdentifier } from "@/lib/host/identifier";
import {
  createHostIdentityToken,
  HOST_IDENTITY_COOKIE,
  hostIdentityCookieOptions,
} from "@/lib/host/identity-session";
import { noteRecoveryIp, RECOVERY_MISMATCH } from "@/lib/host/recovery-flow";
import { confirmHostRecovery } from "@/lib/host/recovery-server";
import { readLimitedJson } from "@/lib/security/guest-http";
import { clientIpFromRequest, LOGIN_LIMIT_MESSAGE } from "@/lib/security/login-limit";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limit = noteRecoveryIp(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: LOGIN_LIMIT_MESSAGE },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const parsed = await readLimitedJson(request, 4_000);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const body =
    parsed.value && typeof parsed.value === "object"
      ? (parsed.value as { identifier?: unknown; email?: unknown; otp?: unknown })
      : {};

  try {
    const result = await confirmHostRecovery({
      slug: slugFromHostIdentifier(typeof body.identifier === "string" ? body.identifier : ""),
      email: typeof body.email === "string" ? body.email : "",
      otp: typeof body.otp === "string" ? body.otp : "",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (result.identityId) {
      const jar = await cookies();
      jar.set(
        HOST_IDENTITY_COOKIE,
        createHostIdentityToken(result.identityId),
        hostIdentityCookieOptions(),
      );
    }
    return NextResponse.json({ accessCode: result.accessCode, eventId: result.eventId });
  } catch (error) {
    const failure = caughtErrorBody(error, RECOVERY_MISMATCH, 400);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
