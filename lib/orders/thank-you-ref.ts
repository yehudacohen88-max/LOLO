export type ThankYouOrderLoad =
  | { ok: true; paymentStatus: string }
  | { ok: false };

export function thankYouAfterLoad(
  load: ThankYouOrderLoad,
  alreadyConfirmedPaid: boolean,
): { clearRef: boolean; replaceDisplay: boolean; confirmedPaid: boolean } {
  if (load.ok && load.paymentStatus === "paid") {
    return { clearRef: true, replaceDisplay: true, confirmedPaid: true };
  }
  if (load.ok) {
    return { clearRef: false, replaceDisplay: true, confirmedPaid: false };
  }
  if (alreadyConfirmedPaid) {
    return { clearRef: false, replaceDisplay: false, confirmedPaid: true };
  }
  return { clearRef: false, replaceDisplay: true, confirmedPaid: false };
}
