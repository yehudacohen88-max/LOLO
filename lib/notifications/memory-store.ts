import { randomUUID } from "node:crypto";
import {
  NOTIFICATION_LOCALE,
  type IdempotencyKey,
  type NewQueuedMessage,
  type NotificationMessage,
  type NotificationStatus,
  type NotificationStore,
  type TemplateCopy,
} from "./types";

function keyOf(key: IdempotencyKey) {
  return [key.eventType, key.entityId, key.recipient, key.channel].join("\n");
}

export class MemoryNotificationStore implements NotificationStore {
  readonly rows = new Map<string, NotificationMessage>();
  readonly versions: NotificationMessage[] = [];
  templates = new Map<string, TemplateCopy>();

  private snapshot(row: NotificationMessage) {
    this.versions.push({ ...row });
    return row;
  }

  async findByKey(key: IdempotencyKey) {
    return this.rows.get(keyOf(key)) ?? null;
  }

  async getTemplate(eventType: IdempotencyKey["eventType"], channel: IdempotencyKey["channel"]) {
    return this.templates.get(`${eventType}.${channel}`) ?? null;
  }

  putTemplate(
    eventType: IdempotencyKey["eventType"],
    channel: IdempotencyKey["channel"],
    copy: TemplateCopy,
  ) {
    this.templates.set(`${eventType}.${channel}`, copy);
  }

  async insertQueued(message: NewQueuedMessage) {
    const key = keyOf(message);
    if (this.rows.has(key)) {
      return { conflict: true as const };
    }
    const now = new Date().toISOString();
    const row: NotificationMessage = {
      id: randomUUID(),
      templateId: message.templateId,
      locale: NOTIFICATION_LOCALE,
      eventType: message.eventType,
      entityId: message.entityId,
      recipient: message.recipient,
      channel: message.channel,
      status: "queued",
      provider: message.provider,
      providerMessageId: null,
      providerResponse: null,
      error: null,
      subject: message.subject,
      body: message.body,
      relatedOrderId: message.relatedOrderId,
      simulated: message.simulated,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(key, row);
    return { inserted: this.snapshot(row) };
  }

  private require(id: string) {
    for (const row of this.rows.values()) {
      if (row.id === id) {
        return row;
      }
    }
    throw new Error("ההודעה לא נמצאה ביומן.");
  }

  async markSent(id: string, providerMessageId: string, providerResponse: string) {
    const row = this.require(id);
    row.status = "sent_simulated";
    row.providerMessageId = providerMessageId;
    row.providerResponse = providerResponse;
    row.error = null;
    row.simulated = true;
    row.updatedAt = new Date().toISOString();
    return this.snapshot(row);
  }

  async markFailed(id: string, error: string) {
    const row = this.require(id);
    row.status = "failed";
    row.error = error;
    row.providerResponse = null;
    row.updatedAt = new Date().toISOString();
    return this.snapshot(row);
  }

  async list(query: { limit: number; orderId?: string; status?: NotificationStatus }) {
    return [...this.rows.values()]
      .filter((row) => (query.orderId ? row.relatedOrderId === query.orderId : true))
      .filter((row) => (query.status ? row.status === query.status : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, query.limit);
  }
}
