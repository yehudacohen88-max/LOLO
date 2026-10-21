import { NextResponse } from "next/server";
import { getOrderForGuest, upsertPendingOrder } from "@/lib/orders/repository";
import {
  GUEST_BODY_BYTES,
  guestItemsProblem,
  guestTextProblem,
  isUuid,
  publicSlugOrNull,
} from "@/lib/orders/guest-input";
import type { OrderItemInput } from "@/lib/orders/types";
import { toPublicOrder } from "@/lib/events/public-guest";
import { clientIpFromRequest } from "@/lib/security/login-limit";
import { takeOrderRead, takeOrderWrite } from "@/lib/security/guest-limit";
import { guestLimitResponse, readLimitedJson } from "@/lib/security/guest-http";
import { caughtErrorBody } from "@/lib/security/required-secret";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const limited = guestLimitResponse(takeOrderRead(clientIpFromRequest(request)));
  if (limited) {
    return limited;
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  const accessToken = searchParams.get("accessToken") ?? "";

  if (!isUuid(id) || !isUuid(accessToken)) {
    return jsonError("לא מצאנו את ההזמנה.", 400);
  }

  try {
    const order = await getOrderForGuest(id, accessToken);
    if (!order) {
      return jsonError("ההזמנה לא נמצאה.", 404);
    }
    return NextResponse.json(toPublicOrder(order));
  } catch (error) {
    const body = caughtErrorBody(error, "טעינת ההזמנה נכשלה.", 500);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const parsed = await readLimitedJson(request, GUEST_BODY_BYTES.order);
  if (!parsed.ok) {
    return jsonError(parsed.error, parsed.status);
  }

  const body = parsed.value as {
    slug?: string;
    orderId?: string;
    accessToken?: string;
    guestName?: string;
    guestPhone?: string;
    guestEmail?: string;
    wantsConfirmation?: boolean;
    greetingText?: string;
    items?: OrderItemInput[];
  };
  const slug = publicSlugOrNull(body.slug ?? "");
  if (!slug) {
    return jsonError("האירוע לא נמצא.", 400);
  }
  const items = Array.isArray(body.items) ? body.items : [];
  const problem =
    guestTextProblem({
      guestName: body.guestName ?? "",
      guestPhone: body.guestPhone ?? "",
      guestEmail: body.guestEmail ?? "",
      greetingText: body.greetingText ?? "",
    }) ?? guestItemsProblem(items);
  if (problem) {
    return jsonError(problem, 400);
  }

  const limited = guestLimitResponse(takeOrderWrite(ip, slug));
  if (limited) {
    return limited;
  }

  try {
    const order = await upsertPendingOrder({
      slug,
      orderId: body.orderId,
      accessToken: body.accessToken,
      guestName: body.guestName ?? "",
      guestPhone: body.guestPhone ?? "",
      guestEmail: body.guestEmail ?? "",
      wantsConfirmation: body.wantsConfirmation !== false,
      greetingText: body.greetingText ?? "",
      items,
    });

    return NextResponse.json(toPublicOrder(order));
  } catch (error) {
    const failure = caughtErrorBody(error, "שמירת ההזמנה נכשלה.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
