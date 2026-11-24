import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { jsonAdminError, isUuid, parseListLimit } from "@/lib/notifications/http";
import { listNotificationMessages } from "@/lib/notifications/repository";
import { NOTIFICATION_STATUSES, type NotificationStatus } from "@/lib/notifications/types";

export const dynamic = "force-dynamic";

function parseStatus(raw: string | null): NotificationStatus | undefined {
  if (!raw) {
    return undefined;
  }
  return NOTIFICATION_STATUSES.find((status) => status === raw);
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  const url = new URL(request.url);
  const statusRaw = url.searchParams.get("status");
  const status = parseStatus(statusRaw);
  if (statusRaw && !status) {
    return NextResponse.json({ error: "סטטוס לא מוכר." }, { status: 400 });
  }

  const orderId = url.searchParams.get("orderId")?.trim() ?? "";
  if (orderId && !isUuid(orderId)) {
    return NextResponse.json({ error: "מזהה הזמנה אינו תקין." }, { status: 400 });
  }

  try {
    const messages = await listNotificationMessages({
      limit: parseListLimit(url.searchParams.get("limit")),
      orderId: orderId || undefined,
      status,
    });
    return NextResponse.json({ messages });
  } catch (error) {
    return jsonAdminError(error, "טעינת יומן ההודעות נכשלה.");
  }
}
