import { earliestDueAt, splitCommission, sumMoney, settlementDueAt } from "@/lib/settlements/money";

const PAYMENT_METHODS = ["bank_transfer", "invoice", "manual", "other"] as const;

export type LedgerRedemptionInput = {
  id: string;
  storeId: string;
  voucherId: string;
  fullyRedeemed: boolean;
  gross: number;
  commissionPercent: number | null;
  paymentTermsDays: number | null;
  redeemedAt: string;
};

type LedgerLine = {
  redemptionId: string;
  grossAmount: number;
  commissionAmount: number;
  payableAmount: number;
  dueAt: string;
  released: boolean;
};

export type LedgerSettlement = {
  id: string;
  storeId: string;
  status: "PENDING" | "PAID" | "CANCELLED";
  idempotencyKey: string;
  lines: LedgerLine[];
  grossAmount: number;
  commissionAmount: number;
  payableAmount: number;
  dueAt: string;
  paidAt: string | null;
  paymentReference: string | null;
  paymentMethod: string | null;
};

type RedemptionRow = LedgerRedemptionInput & {
  settlementStatus: "UNSETTLED" | "SETTLEMENT_PENDING" | "SETTLED";
};

type VoucherRow = {
  fullyRedeemed: boolean;
  status: "PARTIALLY_REDEEMED" | "REDEEMED" | "SETTLEMENT_PENDING" | "SETTLED";
};

export type CreateSettlementResult =
  | { ok: true; idempotent: boolean; settlement: LedgerSettlement }
  | { ok: false; reason: "none" };

export type MarkPaidResult =
  | { ok: true; idempotent: boolean; settlement: LedgerSettlement }
  | { ok: false; reason: "missing" | "cancelled" | "reference" | "method" };

/**
 * In-memory stand-in for create_store_settlement.
 * Parallel calls for one ledger are serialized the way the store advisory lock is.
 * A redemption can sit on at most one unreleased line.
 */
export class SettlementLedger {
  settlements: LedgerSettlement[] = [];
  private redemptions: RedemptionRow[] = [];
  private vouchers = new Map<string, VoucherRow>();
  private sequence = 0;
  private chain: Promise<void> = Promise.resolve();

  addRedemption(input: LedgerRedemptionInput) {
    if (this.redemptions.some((row) => row.id === input.id)) {
      throw new Error("settlement_redemption_taken");
    }
    this.redemptions.push({ ...input, settlementStatus: "UNSETTLED" });
    const voucher = this.vouchers.get(input.voucherId) ?? {
      fullyRedeemed: input.fullyRedeemed,
      status: input.fullyRedeemed ? "REDEEMED" : "PARTIALLY_REDEEMED",
    };
    voucher.fullyRedeemed = input.fullyRedeemed;
    if (!voucher.fullyRedeemed) {
      voucher.status = "PARTIALLY_REDEEMED";
    } else if (voucher.status === "PARTIALLY_REDEEMED") {
      voucher.status = "REDEEMED";
    }
    this.vouchers.set(input.voucherId, voucher);
    this.syncVoucher(input.voucherId);
  }

  voucherStatus(voucherId: string) {
    return this.vouchers.get(voucherId)?.status ?? "";
  }

  activeRedemptionIds() {
    const ids = this.settlements.flatMap((settlement) =>
      settlement.lines.filter((line) => !line.released).map((line) => line.redemptionId),
    );
    return ids;
  }

  create(storeId: string, idempotencyKey: string) {
    return this.exclusive(() => {
      const existing = this.settlements.find(
        (settlement) =>
          settlement.storeId === storeId && settlement.idempotencyKey === idempotencyKey,
      );
      if (existing) {
        return { ok: true as const, idempotent: true, settlement: existing };
      }

      const open = this.redemptions.filter(
        (row) => row.storeId === storeId && row.settlementStatus === "UNSETTLED",
      );
      if (open.length === 0) {
        return { ok: false as const, reason: "none" as const };
      }

      const active = new Set(this.activeRedemptionIds());
      const lines: LedgerLine[] = open.map((row) => {
        if (active.has(row.id)) {
          throw new Error("settlement_redemption_taken");
        }
        const split = splitCommission(row.gross, row.commissionPercent);
        return {
          redemptionId: row.id,
          grossAmount: split.grossAmount,
          commissionAmount: split.commissionAmount,
          payableAmount: split.payableAmount,
          dueAt: settlementDueAt(row.redeemedAt, row.paymentTermsDays),
          released: false,
        };
      });

      this.sequence += 1;
      const settlement: LedgerSettlement = {
        id: `settlement-${this.sequence}`,
        storeId,
        status: "PENDING",
        idempotencyKey,
        lines,
        grossAmount: sumMoney(lines.map((line) => line.grossAmount)),
        commissionAmount: sumMoney(lines.map((line) => line.commissionAmount)),
        payableAmount: sumMoney(lines.map((line) => line.payableAmount)),
        dueAt: earliestDueAt(lines.map((line) => line.dueAt)),
        paidAt: null,
        paymentReference: null,
        paymentMethod: null,
      };
      this.settlements.push(settlement);
      for (const row of open) {
        row.settlementStatus = "SETTLEMENT_PENDING";
        this.syncVoucher(row.voucherId);
      }
      return { ok: true as const, idempotent: false, settlement };
    });
  }

  markPaid(
    settlementId: string,
    input: { reference: string | null; method: string | null; now: string },
  ) {
    return this.exclusive(() => {
      const settlement = this.settlements.find((item) => item.id === settlementId);
      if (!settlement) {
        return { ok: false as const, reason: "missing" as const };
      }
      if (settlement.status === "PAID") {
        return { ok: true as const, idempotent: true, settlement };
      }
      if (settlement.status === "CANCELLED") {
        return { ok: false as const, reason: "cancelled" as const };
      }

      const reference = input.reference?.trim() || null;
      if (reference && reference.length > 80) {
        return { ok: false as const, reason: "reference" as const };
      }
      const method = input.method?.trim() || "manual";
      if (!PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) {
        return { ok: false as const, reason: "method" as const };
      }

      settlement.status = "PAID";
      settlement.paidAt = input.now;
      settlement.paymentReference = reference;
      settlement.paymentMethod = method;
      for (const line of settlement.lines) {
        if (line.released) {
          continue;
        }
        const redemption = this.redemptions.find((row) => row.id === line.redemptionId);
        if (!redemption || redemption.settlementStatus !== "SETTLEMENT_PENDING") {
          throw new Error("settlement_redemption_taken");
        }
        redemption.settlementStatus = "SETTLED";
        this.syncVoucher(redemption.voucherId);
      }
      return { ok: true as const, idempotent: false, settlement };
    });
  }

  cancel(settlementId: string) {
    return this.exclusive(() => {
      const settlement = this.settlements.find((item) => item.id === settlementId);
      if (!settlement) {
        return { ok: false as const, reason: "missing" as const };
      }
      if (settlement.status === "CANCELLED") {
        return { ok: true as const, idempotent: true, settlement };
      }
      if (settlement.status === "PAID") {
        return { ok: false as const, reason: "paid" as const };
      }
      settlement.status = "CANCELLED";
      for (const line of settlement.lines) {
        if (line.released) {
          continue;
        }
        line.released = true;
        const redemption = this.redemptions.find((row) => row.id === line.redemptionId);
        if (!redemption || redemption.settlementStatus !== "SETTLEMENT_PENDING") {
          throw new Error("settlement_redemption_taken");
        }
        redemption.settlementStatus = "UNSETTLED";
        this.syncVoucher(redemption.voucherId);
      }
      return { ok: true as const, idempotent: false, settlement };
    });
  }

  private syncVoucher(voucherId: string) {
    const voucher = this.vouchers.get(voucherId);
    if (!voucher || !voucher.fullyRedeemed) {
      return;
    }
    if (
      voucher.status !== "REDEEMED" &&
      voucher.status !== "SETTLEMENT_PENDING" &&
      voucher.status !== "SETTLED"
    ) {
      return;
    }
    const rows = this.redemptions.filter((row) => row.voucherId === voucherId);
    const unsettled = rows.filter((row) => row.settlementStatus === "UNSETTLED").length;
    const pending = rows.filter((row) => row.settlementStatus === "SETTLEMENT_PENDING").length;
    const settled = rows.filter((row) => row.settlementStatus === "SETTLED").length;
    if (unsettled > 0) {
      voucher.status = "REDEEMED";
    } else if (pending > 0) {
      voucher.status = "SETTLEMENT_PENDING";
    } else if (settled > 0) {
      voucher.status = "SETTLED";
    }
  }

  private exclusive<T>(fn: () => T): Promise<T> {
    const run = this.chain.then(() => fn());
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
