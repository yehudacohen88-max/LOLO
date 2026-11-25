import { roundMoney } from "@/lib/money";
import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_LOCALE,
  type NotificationChannel,
  type NotificationEventType,
  type TemplateCopy,
  type TemplateVariables,
} from "./types";

const EMAIL: Record<NotificationEventType, { subject: string; body: string }> = {
  purchase_confirmed: {
    subject: "אישור השתתפות במתנה – {{eventTitle}}",
    body: [
      "שלום {{guestName}},",
      "תודה על ההשתתפות באירוע {{eventTitle}}.",
      "הסכום שחויב: {{chargedAmount}}{{currencySuffix}}",
      "מספר הזמנה: {{orderId}}",
      "{{paymentNote}}",
    ].join("\n"),
  },
  contribution_updated: {
    subject: "עדכון השתתפות – {{eventTitle}}",
    body: [
      "שלום {{hostName}},",
      "התקבלה השתתפות חדשה באירוע {{eventTitle}}.",
      "מאת: {{guestName}}",
      "סכום ההשתתפות: {{amount}}{{currencySuffix}}",
      "מספר הזמנה: {{orderId}}",
      "{{paymentNote}}",
    ].join("\n"),
  },
  voucher_issued: {
    subject: "הונפק שובר – {{eventTitle}}",
    body: [
      "הונפק שובר לאירוע {{eventTitle}}.",
      "מתנה: {{giftTitle}}",
      "סכום: {{amount}}{{currencySuffix}}",
      "קוד שובר: {{voucherCode}}",
      "בית עסק: {{storeName}}",
    ].join("\n"),
  },
  voucher_redeemed: {
    subject: "שובר מומש – {{storeName}}",
    body: [
      "שובר מומש.",
      "קוד: {{voucherCode}}",
      "סכום שמומש: {{amount}}{{currencySuffix}}",
      "בית עסק: {{storeName}}",
      "אירוע: {{eventTitle}}",
    ].join("\n"),
  },
  refund: {
    subject: "עדכון החזר – {{eventTitle}}",
    body: [
      "שלום {{guestName}},",
      "נרשם החזר עבור הזמנה {{orderId}} באירוע {{eventTitle}}.",
      "סכום ההחזר: {{amount}}{{currencySuffix}}",
      "{{paymentNote}}",
    ].join("\n"),
  },
};

const SHORT: Record<NotificationEventType, string> = {
  purchase_confirmed:
    "שלום {{guestName}}, אישרנו השתתפות ב{{eventTitle}} על סך {{chargedAmount}}{{currencySuffix}}. הזמנה {{orderId}}. {{paymentNote}}",
  contribution_updated:
    "{{hostName}}, התקבלה השתתפות מ{{guestName}} ל{{eventTitle}} על סך {{amount}}{{currencySuffix}}. הזמנה {{orderId}}.",
  voucher_issued:
    "הונפק שובר ל{{eventTitle}} על סך {{amount}}{{currencySuffix}}. קוד {{voucherCode}}.",
  voucher_redeemed:
    "שובר {{voucherCode}} מומש על סך {{amount}}{{currencySuffix}} ב{{storeName}}.",
  refund:
    "שלום {{guestName}}, נרשם החזר על סך {{amount}}{{currencySuffix}} להזמנה {{orderId}}. {{paymentNote}}",
};

export function templateId(eventType: NotificationEventType, channel: NotificationChannel) {
  return `${eventType}.${channel}.${NOTIFICATION_LOCALE}`;
}

export function builtinTemplate(
  eventType: NotificationEventType,
  channel: NotificationChannel,
): TemplateCopy {
  if (channel === "email") {
    const copy = EMAIL[eventType];
    return {
      id: templateId(eventType, channel),
      subject: copy.subject,
      body: copy.body,
    };
  }
  return {
    id: templateId(eventType, channel),
    subject: "",
    body: SHORT[eventType],
  };
}

export function listBuiltinTemplates(): Array<TemplateCopy & {
  eventType: NotificationEventType;
  channel: NotificationChannel;
}> {
  const rows = [];
  for (const eventType of NOTIFICATION_EVENT_TYPES) {
    for (const channel of ["email", "sms", "whatsapp"] as const) {
      rows.push({ ...builtinTemplate(eventType, channel), eventType, channel });
    }
  }
  return rows;
}

export function escapeTemplateValue(value: string, channel: NotificationChannel) {
  const capped = value.slice(0, 500);
  if (channel !== "email") {
    return capped;
  }
  return capped
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * One pass. Values are escaped first, so a guest name that contains
 * `{{amount}}` is inserted as text and is not rendered again.
 */
export function renderTemplate(
  source: string,
  variables: TemplateVariables,
  channel: NotificationChannel,
) {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) {
      return match;
    }
    return escapeTemplateValue(variables[key] ?? "", channel);
  });
}

export function renderCopy(
  copy: TemplateCopy,
  variables: TemplateVariables,
  channel: NotificationChannel,
) {
  return {
    templateId: copy.id,
    subject: renderTemplate(copy.subject, variables, channel).trim(),
    body: renderTemplate(copy.body, variables, channel)
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

export function formatNoticeAmount(value: number) {
  return roundMoney(value).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function currencySuffix(currency: string | null) {
  const code = currency?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{3}$/.test(code)) {
    return "";
  }
  return ` ${code}`;
}
