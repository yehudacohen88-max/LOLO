import { NextResponse } from "next/server";
import {
  clearLoginFailures,
  clientIpFromRequest,
  LOGIN_LIMIT_MESSAGE,
  loginAttemptAllowed,
  loginRetryAfterSeconds,
  recordLoginFailure,
} from "@/lib/security/login-limit";
import { getStoreSession } from "@/lib/store/session";
import { jsonFromError } from "@/lib/vouchers/http";
import { VoucherActionError } from "@/lib/vouchers/messages";
import { lookupStoreVoucher } from "@/lib/vouchers/repository";

export const dynamic = "force-dynamic";

function limitedResponse(ip: string) {
  const retryAfter = loginRetryAfterSeconds("voucherLookup", ip);
  return NextResponse.json(
    { error: LOGIN_LIMIT_MESSAGE },
    {
      status: 429,
      headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
    },
  );
}

export async function POST(request: Request) {
  const session = await getStoreSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  const ip = clientIpFromRequest(request);
  if (!loginAttemptAllowed("voucherLookup", ip)) {
    return limitedResponse(ip);
  }

  try {
    const body = (await request.json()) as { code?: unknown };
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code || code.length > 200) {
      recordLoginFailure("voucherLookup", ip);
      return NextResponse.json({ error: "יש להזין קוד שובר." }, { status: 400 });
    }
    const voucher = await lookupStoreVoucher(session.storeId, code);
    clearLoginFailures("voucherLookup", ip);
    return NextResponse.json(voucher);
  } catch (error) {
    if (error instanceof VoucherActionError && error.status === 404) {
      recordLoginFailure("voucherLookup", ip);
    }
    return jsonFromError(error, "השובר לא נמצא.");
  }
}
