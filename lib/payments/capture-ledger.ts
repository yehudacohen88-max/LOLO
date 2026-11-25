/**
 * In-memory form of the payment_attempts unique rules:
 * one succeeded capture per order, replay on the same idempotency key,
 * replay on the same provider event id. Postgres enforces the same rules.
 * Two overlapping commits keep the first paid_at.
 */
export type CaptureRecord = {
  orderId: string;
  idempotencyKey: string;
  provider: string;
  providerReference: string;
  providerEventId: string | null;
  paidAt: string;
};

export type CaptureResult = {
  paidAt: string;
  providerReference: string;
  replayed: boolean;
};

type OrderCapture = {
  paidAt: string;
  providerReference: string;
  commits: CaptureRecord[];
};

export function createCaptureLedger() {
  const orders = new Map<string, OrderCapture>();

  function commit(capture: CaptureRecord): CaptureResult {
    const current = orders.get(capture.orderId);
    if (current) {
      const sameKey = current.commits.find((row) => row.idempotencyKey === capture.idempotencyKey);
      if (sameKey) {
        return {
          paidAt: sameKey.paidAt,
          providerReference: sameKey.providerReference,
          replayed: true,
        };
      }
      const sameEvent = capture.providerEventId
        ? current.commits.find(
            (row) =>
              row.provider === capture.provider && row.providerEventId === capture.providerEventId,
          )
        : undefined;
      if (sameEvent) {
        return {
          paidAt: sameEvent.paidAt,
          providerReference: sameEvent.providerReference,
          replayed: true,
        };
      }
      return {
        paidAt: current.paidAt,
        providerReference: current.providerReference,
        replayed: true,
      };
    }

    orders.set(capture.orderId, {
      paidAt: capture.paidAt,
      providerReference: capture.providerReference,
      commits: [capture],
    });
    return {
      paidAt: capture.paidAt,
      providerReference: capture.providerReference,
      replayed: false,
    };
  }

  return { commit };
}

export async function commitCapturesTogether(
  ledger: ReturnType<typeof createCaptureLedger>,
  captures: [CaptureRecord, CaptureRecord],
) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = Promise.all(
    captures.map(async (capture) => {
      await gate;
      return ledger.commit(capture);
    }),
  );
  release();
  return pending;
}
