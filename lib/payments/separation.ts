import { isSimulatedPayment } from "@/lib/vouchers/demo-funding";
import {
  DEMO_CANNOT_BE_REAL_MONEY,
  PAYMENTS_LIVE_NOT_ENABLED,
  PaymentsNotEnabledError,
} from "./messages";

/**
 * A capture written by this package is demo money. The shared classifier must
 * agree, and the provider name must be demo with a demo- reference.
 * Allow-listed live names are not written here.
 */
export function assertDemoMoneyCapture(attempt: { provider: string; paymentReference: string }) {
  const provider = attempt.provider.trim().toLowerCase();
  const reference = attempt.paymentReference.trim().toLowerCase();
  if (provider !== "demo" || !reference.startsWith("demo-")) {
    throw new PaymentsNotEnabledError(PAYMENTS_LIVE_NOT_ENABLED);
  }
  const simulated = isSimulatedPayment({
    amount: 1,
    paymentStatus: "paid",
    paymentProvider: provider,
    paymentReference: reference,
  });
  if (!simulated) {
    throw new Error(DEMO_CANNOT_BE_REAL_MONEY);
  }
}
