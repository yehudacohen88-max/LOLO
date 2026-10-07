import { NextResponse } from "next/server";
import { getOrderForGuest, upsertPendingOrder } from "@/lib/orders/repository";
import type { OrderItemInput } from "@/lib/orders/types";
import { caughtErrorBody } from "@/lib/security/required-secret";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  const accessToken = searchParams.get("accessToken") ?? "";

  if (!id || !accessToken) {
    return NextResponse.json({ error: "לא מצאנו את ההזמנה." }, { status: 400 });
  }

  try {
    const order = await getOrderForGuest(id, accessToken);
    if (!order) {
      return NextResponse.json({ error: "ההזמנה לא נמצאה." }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (error) {
    const body = caughtErrorBody(error, "טעינת ההזמנה נכשלה.", 500);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
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

    const order = await upsertPendingOrder({
      slug: body.slug ?? "",
      orderId: body.orderId,
      accessToken: body.accessToken,
      guestName: body.guestName ?? "",
      guestPhone: body.guestPhone ?? "",
      guestEmail: body.guestEmail ?? "",
      wantsConfirmation: body.wantsConfirmation !== false,
      greetingText: body.greetingText ?? "",
      items: Array.isArray(body.items) ? body.items : [],
    });

    return NextResponse.json(order);
  } catch (error) {
    const body = caughtErrorBody(error, "שמירת ההזמנה נכשלה.");
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
