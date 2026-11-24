import type { NotificationChannel, NotificationEventType, NotificationStatus } from "./types";

export const EVENT_TYPE_LABELS: Record<NotificationEventType, string> = {
  purchase_confirmed: "אישור השתתפות",
  contribution_updated: "עדכון למארח",
  voucher_issued: "שובר הונפק",
  voucher_redeemed: "שובר מומש",
  refund: "החזר",
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: "דוא״ל",
  sms: "מסרון",
  whatsapp: "וואטסאפ",
};

export const STATUS_LABELS: Record<NotificationStatus, string> = {
  queued: "בתור",
  sent_simulated: "נשלח (הדגמה)",
  failed: "נכשל",
};
