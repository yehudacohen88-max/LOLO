import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readRequiredEnv } from "./required-secret";

export function signScopedPayload(secretEnv: string, typ: string, encoded: string) {
  const secret = readRequiredEnv(secretEnv);
  return createHmac("sha256", secret).update(`${typ}:${encoded}`).digest("base64url");
}

export function signaturesMatch(given: string, expected: string) {
  const givenBuffer = Buffer.from(given);
  const expectedBuffer = Buffer.from(expected);
  if (givenBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(givenBuffer, expectedBuffer);
}
