import type { Db } from "@/lib/desk/db";
import { isMissingRelation, rowsOf } from "@/lib/desk/db";
import { NOTIFICATIONS_UNAVAILABLE } from "@/lib/desk/messages";

export type NotificationLogRow = {
  id: string;
  channel: string;
  status: string;
  subject: string;
  createdAt: string;
};

export type NotificationLogPage =
  | { available: false; message: string; rows: [] }
  | { available: true; message: ""; rows: NotificationLogRow[] };

const COLUMNS = "id, channel, status, subject, created_at";

type Row = {
  id: string;
  channel: string;
  status: string;
  subject: string | null;
  created_at: string;
};

export async function listOrderNotificationLog(
  orderId: string,
  db: Db,
): Promise<NotificationLogPage> {
  const result = await db
    .from("notification_messages")
    .select(COLUMNS)
    .eq("related_order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (result.error) {
    if (isMissingRelation(result.error, "notification_messages")) {
      return { available: false, message: NOTIFICATIONS_UNAVAILABLE, rows: [] };
    }
    throw result.error;
  }
  return {
    available: true,
    message: "",
    rows: rowsOf<Row>(result).map((row) => ({
      id: row.id,
      channel: row.channel,
      status: row.status,
      subject: row.subject ?? "",
      createdAt: row.created_at,
    })),
  };
}
