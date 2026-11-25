import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_SIGNATURE_HEADER = "x-lolo-signature";

export function signWebhookBody(body: string, secret: string) {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function signaturesMatch(presented: string, expected: string) {
  if (presented.length !== expected.length || presented.length === 0) {
    return false;
  }
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

export function verifyWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  secret: string;
}) {
  if (!input.secret || !input.signature) {
    return { ok: false as const };
  }
  const presented = input.signature.trim().toLowerCase().replace(/^sha256=/, "");
  const expected = signWebhookBody(input.rawBody, input.secret);
  if (!signaturesMatch(presented, expected)) {
    return { ok: false as const };
  }
  return { ok: true as const };
}
