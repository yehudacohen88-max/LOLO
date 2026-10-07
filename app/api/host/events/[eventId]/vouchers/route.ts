import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  HOST_SESSION_COOKIE,
  readHostSessionToken,
} from "@/lib/host/session";
import { jsonFromError } from "@/lib/vouchers/http";
import { parseIssueVoucherInput } from "@/lib/vouchers/input";
import { voucherErrorMessage, VoucherActionError } from "@/lib/vouchers/messages";
import {
  confirmedTermsDiffer,
  issueGiftVoucher,
  resolveIssueStore,
} from "@/lib/vouchers/repository";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const jar = await cookies();
  const session = readHostSessionToken(jar.get(HOST_SESSION_COOKIE)?.value);
  if (!session || session.eventId !== eventId) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    const input = parseIssueVoucherInput(await request.json());
    const store = await resolveIssueStore(eventId, input.giftId, input.storeId);
    if (confirmedTermsDiffer(input, store.terms)) {
      throw new VoucherActionError(voucherErrorMessage("voucher_terms_changed"), 409);
    }
    const issued = await issueGiftVoucher({
      eventId,
      giftId: input.giftId,
      storeId: store.id,
      expectedAmount: input.expectedAmount,
      idempotencyKey: input.idempotencyKey,
      terms: store.terms,
    });
    return NextResponse.json(issued);
  } catch (error) {
    return jsonFromError(error, "הנפקת השובר נכשלה.");
  }
}
