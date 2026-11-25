import { builtinTemplate, renderCopy } from "./templates";
import type {
  IdempotencyKey,
  NewQueuedMessage,
  NotificationChannel,
  NotificationEventType,
  NotificationMessage,
  NotificationProvider,
  NotificationStore,
  TemplateVariables,
} from "./types";

const PROVIDER_RESPONSE = "simulated; no network";
const REFUSED_ERROR = "הספק אינו מחובר. לא נשלחה הודעה.";

export type DispatchInput = {
  eventType: NotificationEventType;
  entityId: string;
  channel: NotificationChannel;
  recipient: string;
  relatedOrderId: string | null;
  variables: TemplateVariables;
};

export type DispatchResult = {
  message: NotificationMessage;
  idempotent: boolean;
};

function errorText(error: unknown) {
  const message = error instanceof Error && error.message ? error.message : "שליחת ההודעה נכשלה.";
  return message.replace(/\s+/g, " ").trim().slice(0, 500);
}

function queuedRow(
  input: DispatchInput,
  provider: NotificationProvider,
  rendered: { templateId: string; subject: string; body: string },
): NewQueuedMessage {
  return {
    templateId: rendered.templateId,
    eventType: input.eventType,
    entityId: input.entityId,
    recipient: input.recipient,
    channel: input.channel,
    provider: provider.name,
    subject: rendered.subject,
    body: rendered.body,
    relatedOrderId: input.relatedOrderId,
    simulated: provider.isSimulated,
  };
}

/**
 * Writes every attempt. A live provider is recorded as failed and is not called.
 * A simulated provider that throws is recorded as failed, including the message
 * that would have been sent.
 */
export async function dispatchNotification(
  input: DispatchInput,
  deps: { store: NotificationStore; provider: NotificationProvider },
): Promise<DispatchResult> {
  const key: IdempotencyKey = {
    eventType: input.eventType,
    entityId: input.entityId,
    recipient: input.recipient,
    channel: input.channel,
  };
  const existing = await deps.store.findByKey(key);
  if (existing) {
    return { message: existing, idempotent: true };
  }

  const storedTemplate = await deps.store.getTemplate(input.eventType, input.channel);
  const copy = storedTemplate ?? builtinTemplate(input.eventType, input.channel);
  const rendered = renderCopy(copy, input.variables, input.channel);
  const inserted = await deps.store.insertQueued(queuedRow(input, deps.provider, rendered));
  if ("conflict" in inserted) {
    const winner = await deps.store.findByKey(key);
    if (!winner) {
      throw new Error("יומן ההודעות לא שמר את הניסיון.");
    }
    return { message: winner, idempotent: true };
  }

  const row = inserted.inserted;
  if (!deps.provider.isSimulated || deps.provider.name !== "simulated") {
    const failed = await deps.store.markFailed(row.id, REFUSED_ERROR);
    return { message: failed, idempotent: false };
  }

  try {
    const result = await deps.provider.send({
      channel: input.channel,
      to: input.recipient,
      subject: rendered.subject,
      body: rendered.body,
      templateId: rendered.templateId,
      eventType: input.eventType,
      entityId: input.entityId,
    });
    const sent = await deps.store.markSent(row.id, result.providerMessageId, PROVIDER_RESPONSE);
    return { message: sent, idempotent: false };
  } catch (error) {
    const failed = await deps.store.markFailed(row.id, errorText(error));
    return { message: failed, idempotent: false };
  }
}
