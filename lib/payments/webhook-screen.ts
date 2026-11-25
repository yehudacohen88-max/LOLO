import type { DemoPaymentEvent } from "./events";
import {
  WEBHOOK_BAD_PAYLOAD,
  WEBHOOK_BAD_SIGNATURE,
  WEBHOOK_NOT_ENABLED,
} from "./messages";
import type { WebhookCheck } from "./contract";

export type WebhookScreen =
  | { ok: true; event: DemoPaymentEvent }
  | { ok: false; reason: "unconfigured" | "signature" | "payload"; message: string };

/**
 * Reject a bad signature before the body is parsed. An empty test secret
 * refuses every delivery.
 */
export function screenWebhook(input: {
  rawBody: string;
  signature: string | null;
  secret: string;
  verify: (check: { rawBody: string; signature: string | null; secret: string }) => WebhookCheck;
  parse: (rawBody: string) => DemoPaymentEvent;
}): WebhookScreen {
  if (!input.secret.trim()) {
    return { ok: false, reason: "unconfigured", message: WEBHOOK_NOT_ENABLED };
  }
  const verified = input.verify({
    rawBody: input.rawBody,
    signature: input.signature,
    secret: input.secret,
  });
  if (!verified.ok) {
    return { ok: false, reason: "signature", message: WEBHOOK_BAD_SIGNATURE };
  }
  try {
    return { ok: true, event: input.parse(input.rawBody) };
  } catch (error) {
    return {
      ok: false,
      reason: "payload",
      message: error instanceof Error && error.message ? error.message : WEBHOOK_BAD_PAYLOAD,
    };
  }
}
