import {
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";

export const NOTIFICATION_SCHEMA_MESSAGE =
  "יומן ההודעות והמסמכים עדיין לא הותקן. יש להריץ את supabase/notifications-and-documents.sql.";

const logged = new Set<string>();

export class NotificationSchemaMissingError extends Error {
  constructor() {
    super(NOTIFICATION_SCHEMA_MESSAGE);
    this.name = "NotificationSchemaMissingError";
  }
}

export function isMissingNotificationSchema(error: { code?: string; message?: string }) {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  const mentions =
    message.includes("notification_messages") ||
    message.includes("notification_templates") ||
    message.includes("notification_channels") ||
    message.includes("vat_rate_percent") ||
    message.includes("vat_included") ||
    message.includes("default_document_kind") ||
    message.includes("document_currency") ||
    /\bdocuments\b/.test(message);

  const missingRelation =
    code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205";

  if (missingRelation && mentions) {
    return true;
  }

  return (
    mentions &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("could not find"))
  );
}

export function rethrowIfNotificationSchema(error: { code?: string; message?: string } | null) {
  if (!error || !isMissingNotificationSchema(error)) {
    return;
  }

  const key = `${error.code ?? ""}:${error.message ?? ""}`;
  if (!logged.has(key)) {
    logged.add(key);
    console.error("[LOLO] Notification schema is missing.", {
      code: error.code,
      message: error.message,
    });
  }

  throw new NotificationSchemaMissingError();
}

export function unavailableError() {
  const error = new Error(SERVICE_UNAVAILABLE_MESSAGE);
  error.name = "ServiceUnavailableError";
  return error;
}

export function resetNotificationSchemaWarnings() {
  logged.clear();
}
