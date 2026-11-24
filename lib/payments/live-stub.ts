import type { PaymentProvider } from "./contract";
import { PAYMENTS_LIVE_NOT_ENABLED, PaymentsNotEnabledError, REFUND_DEMO_ONLY } from "./messages";

function notEnabled(): never {
  throw new PaymentsNotEnabledError(PAYMENTS_LIVE_NOT_ENABLED);
}

/**
 * Interface stub for any provider name that is not demo and not none.
 * Methods fail closed. This object does not call a payment service.
 */
export function createLiveProviderStub(name: string): PaymentProvider {
  return {
    name,
    isDemo: false,
    async start() {
      notEnabled();
    },
    async confirm() {
      notEnabled();
    },
    async refund() {
      notEnabled();
    },
    verifyWebhook() {
      return { ok: false };
    },
    parseEvent() {
      notEnabled();
    },
  };
}

export function refuseNonDemoRefund(): never {
  throw new Error(REFUND_DEMO_ONLY);
}
