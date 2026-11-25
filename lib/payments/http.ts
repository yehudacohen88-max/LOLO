import "server-only";
import { PaymentsNotEnabledError } from "./messages";
import { caughtErrorBody } from "@/lib/security/required-secret";

export function paymentFailureResponse(error: unknown, fallback: string) {
  if (error instanceof PaymentsNotEnabledError) {
    return { error: error.message, status: 503 as const };
  }
  return caughtErrorBody(error, fallback);
}
