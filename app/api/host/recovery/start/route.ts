import { NextResponse } from "next/server";
import { slugFromHostIdentifier } from "@/lib/host/identifier";
import { noteRecoveryIp, recoveryStartPayload } from "@/lib/host/recovery-flow";
import { startHostRecovery } from "@/lib/host/recovery-server";
import { clientIpFromRequest, LOGIN_LIMIT_MESSAGE } from "@/lib/security/login-limit";
import { readLimitedJson } from "@/lib/security/guest-http";
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
      ? (parsed.value as { identifier?: unknown; email?: unknown })
      : {};
  const slug = slugFromHostIdentifier(typeof body.identifier === "string" ? body.identifier : "");
  const email = typeof body.email === "string" ? body.email : "";

  try {
    const result = await startHostRecovery({ slug, email });
    return NextResponse.json(result);
  } catch (error) {
    const failure = caughtErrorBody(error, "לא ניתן להתחיל שחזור.", 500);
    if (failure.status === 503) {
      return NextResponse.json({ error: failure.error }, { status: 503 });
    }
    return NextResponse.json(recoveryStartPayload());
  }
}
