import { NextResponse } from "next/server";
import { getOrderForGuest, upsertPendingOrder } from "@/lib/orders/repository";
import type { OrderItemInput } from "@/lib/orders/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  const accessToken = searchParams.get("accessToken") ?? "";

  if (!id || !accessToken) {
    return NextResponse.json({ error: "חסר מזהה הזמנה." }, { status: 400 });
  }

  try {
    const order = await getOrderForGuest(id, accessToken);
    if (!order) {
      return NextResponse.json({ error: "ההזמנה לא נמצאה." }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "טעינת ההזמנה נכשלה.";
    return NextResponse.json({ error: message }, { status: 500 });
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
    const message =
      error instanceof Error ? error.message : "שמירת ההזמנה נכשלה.";
    const status = message.includes("חסר מפתח") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
