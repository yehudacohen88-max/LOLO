import { NextResponse } from "next/server";
import {
  clientIpFromRequest,
  LOGIN_LIMIT_MESSAGE,
  loginAttemptAllowed,
  loginRetryAfterSeconds,
  recordLoginFailure,
} from "@/lib/security/login-limit";
import { getStoreSession } from "@/lib/store/session";
import { jsonFromError } from "@/lib/vouchers/http";
import { parseRedeemVoucherInput } from "@/lib/vouchers/input";
import { VoucherActionError } from "@/lib/vouchers/messages";
import { redeemVoucher } from "@/lib/vouchers/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getStoreSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  const ip = clientIpFromRequest(request);
  if (!loginAttemptAllowed("voucherLookup", ip)) {
    const retryAfter = loginRetryAfterSeconds("voucherLookup", ip);
    return NextResponse.json(
      { error: LOGIN_LIMIT_MESSAGE },
      {
        status: 429,
        headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
      },
    );
  }

  try {
    const input = parseRedeemVoucherInput(await request.json());
    const result = await redeemVoucher({
      storeId: session.storeId,
      channel: "store",
      redeemedBy: session.storeId,
      amount: input.amount,
      reference: input.reference,
      rawCode: input.code,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof VoucherActionError && error.status === 404) {
      recordLoginFailure("voucherLookup", ip);
    }
    return jsonFromError(error, "המימוש נכשל.");
  }
}
