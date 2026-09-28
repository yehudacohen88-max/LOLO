import { NextResponse } from "next/server";
import { publishEventOnServer } from "@/lib/events/publish-server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const created = await publishEventOnServer({
      title: typeof body.title === "string" ? body.title : "",
      hostName: typeof body.hostName === "string" ? body.hostName : "",
      eventType: typeof body.eventType === "string" ? body.eventType : "",
      date: typeof body.date === "string" ? body.date : "",
      time: typeof body.time === "string" ? body.time : "",
      venueName: typeof body.venueName === "string" ? body.venueName : "",
      address: typeof body.address === "string" ? body.address : "",
      message: typeof body.message === "string" ? body.message : "",
      coverImage: typeof body.coverImage === "string" ? body.coverImage : "",
      giftMode: typeof body.giftMode === "string" ? body.giftMode : "",
      moneyAmounts: body.moneyAmounts,
      allowCustomAmount: body.allowCustomAmount !== false,
      moneyDisplay:
        typeof body.moneyDisplay === "string" ? body.moneyDisplay : "amounts",
      gifts: body.gifts,
      guests: body.guests,
    });

    const { accessCode, ...event } = created;

    return NextResponse.json({
      id: event.id,
      slug: event.slug,
      accessCode,
      event,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "שמירת האירוע נכשלה.";
    const status = message.includes("חסר מפתח") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
