/**
 * Manual payout provider. Marking a settlement paid records an operator
 * action. This object does not call a bank, a wallet, or any other host.
 */
export type PayoutRecord = {
  settlementId: string;
  reference: string | null;
  method: string | null;
};

export type PayoutReceipt = {
  recorded: true;
  movedMoney: false;
  externalCall: false;
};

export type PayoutProvider = {
  readonly name: "manual";
  readonly movesMoney: false;
  recordOperatorMark(record: PayoutRecord): Promise<PayoutReceipt>;
};

export const manualPayoutProvider: PayoutProvider = {
  name: "manual",
  movesMoney: false,
  async recordOperatorMark() {
    return { recorded: true, movedMoney: false, externalCall: false };
  },
};
