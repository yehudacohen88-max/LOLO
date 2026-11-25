import type { NotificationChannel } from "./types";

export function normalizeRecipient(channel: NotificationChannel, value: string) {
  const trimmed = value.trim();
  if (channel === "email") {
    return trimmed.toLowerCase();
  }
  return trimmed.replace(/[\s()-]/g, "");
}

export function hasRecipient(channel: NotificationChannel, value: string) {
  const normalized = normalizeRecipient(channel, value);
  if (!normalized) {
    return false;
  }
  if (channel === "email") {
    return normalized.includes("@") && normalized.includes(".");
  }
  return normalized.replace(/\D/g, "").length >= 9;
}
