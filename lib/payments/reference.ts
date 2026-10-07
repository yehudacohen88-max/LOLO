import "server-only";
import { randomBytes } from "node:crypto";

export function createDemoPaymentReference() {
  return `demo-${randomBytes(8).toString("hex")}`;
}
