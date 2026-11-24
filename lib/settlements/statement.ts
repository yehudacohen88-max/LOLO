import { sumMoney, settlementDueAt, splitCommission } from "@/lib/settlements/money";
import {
  resolveCommissionPercent,
  resolvePaymentTermsDays,
  type SettlementPolicy,
} from "@/lib/settlements/policy";
import { roundingIsConfigured } from "@/lib/settlements/rounding";

export type StatementSection = "payable" | "demo" | "blocked";

export type StatementSource = {
  id: string;
  storeId: string;
  storeName: string;
  gross: number;
  commissionPercent: number | null;
  paymentTermsDays: number | null;
  redeemedAt: string;
  voucherCode: string;
  giftTitle: string;
  eventTitle: string;
  demoOnly: boolean;
  settlementId: string | null;
  settlementStatus: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  paymentMethod: string | null;
  /** Set when the row is already stored on a settlement line. */
  stored: {
    commissionPercent: number;
    commissionSpecified: boolean;
    commissionAmount: number;
    payableAmount: number;
    paymentTermsDays: number;
    termsSpecified: boolean;
    dueAt: string;
  } | null;
};

export type StatementRow = {
  id: string;
  section: StatementSection;
  blockedReason: "" | "demo" | "commission" | "terms" | "rounding";
  storeId: string;
  storeName: string;
  settlementId: string | null;
  settlementStatus: string | null;
  voucherCode: string;
  giftTitle: string;
  eventTitle: string;
  grossAmount: number;
  commissionPercent: number | null;
  commissionSpecified: boolean | null;
  commissionAmount: number | null;
  payableAmount: number | null;
  paymentTermsDays: number | null;
  termsSpecified: boolean | null;
  redeemedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  paymentMethod: string | null;
};

export type StatementTotals = {
  payableGross: number;
  payableCommission: number;
  payableAmount: number;
  demoGross: number;
  demoCount: number;
  blockedCount: number;
};

export function buildStatement(sources: StatementSource[], policy: SettlementPolicy) {
  const roundingReady = roundingIsConfigured(policy.rounding);
  const rows: StatementRow[] = sources.map((source) => {
    const base = {
      id: source.id,
      storeId: source.storeId,
      storeName: source.storeName,
      settlementId: source.settlementId,
      settlementStatus: source.settlementStatus,
      voucherCode: source.voucherCode,
      giftTitle: source.giftTitle,
      eventTitle: source.eventTitle,
      grossAmount: source.gross,
      redeemedAt: source.redeemedAt,
      paidAt: source.paidAt,
      paymentReference: source.paymentReference,
      paymentMethod: source.paymentMethod,
    };

    if (source.demoOnly) {
      return {
        ...base,
        section: "demo" as const,
        blockedReason: "demo" as const,
        commissionPercent: null,
        commissionSpecified: null,
        commissionAmount: null,
        payableAmount: null,
        paymentTermsDays: null,
        termsSpecified: null,
        dueAt: null,
      };
    }

    if (source.stored) {
      return {
        ...base,
        section: "payable" as const,
        blockedReason: "" as const,
        commissionPercent: source.stored.commissionPercent,
        commissionSpecified: source.stored.commissionSpecified,
        commissionAmount: source.stored.commissionAmount,
        payableAmount: source.stored.payableAmount,
        paymentTermsDays: source.stored.paymentTermsDays,
        termsSpecified: source.stored.termsSpecified,
        dueAt: source.stored.dueAt,
      };
    }

    if (!roundingReady) {
      return blocked(base, "rounding");
    }

    let commission: ReturnType<typeof resolveCommissionPercent>;
    try {
      commission = resolveCommissionPercent(source.commissionPercent, policy);
    } catch {
      return blocked(base, "commission");
    }

    let terms: ReturnType<typeof resolvePaymentTermsDays>;
    try {
      terms = resolvePaymentTermsDays(source.paymentTermsDays, policy);
    } catch {
      return blocked(base, "terms");
    }

    const split = splitCommission(
      source.gross,
      commission.percent,
      policy.rounding,
      commission.specified,
    );
    return {
      ...base,
      section: "payable" as const,
      blockedReason: "" as const,
      commissionPercent: split.commissionPercent,
      commissionSpecified: split.commissionSpecified,
      commissionAmount: split.commissionAmount,
      payableAmount: split.payableAmount,
      paymentTermsDays: terms.days,
      termsSpecified: terms.specified,
      dueAt: settlementDueAt(source.redeemedAt, terms.days),
    };
  });

  const payable = rows.filter((row) => row.section === "payable");
  const demo = rows.filter((row) => row.section === "demo");
  const totals: StatementTotals = {
    payableGross: sumMoney(payable.map((row) => row.grossAmount)),
    payableCommission: sumMoney(payable.map((row) => row.commissionAmount ?? 0)),
    payableAmount: sumMoney(payable.map((row) => row.payableAmount ?? 0)),
    demoGross: sumMoney(demo.map((row) => row.grossAmount)),
    demoCount: demo.length,
    blockedCount: rows.filter((row) => row.section === "blocked").length,
  };

  return { rows, totals, roundingReady };
}

function blocked(
  base: Omit<
    StatementRow,
    | "section"
    | "blockedReason"
    | "commissionPercent"
    | "commissionSpecified"
    | "commissionAmount"
    | "payableAmount"
    | "paymentTermsDays"
    | "termsSpecified"
    | "dueAt"
  >,
  reason: "rounding" | "commission" | "terms",
): StatementRow {
  return {
    ...base,
    section: "blocked",
    blockedReason: reason,
    commissionPercent: null,
    commissionSpecified: null,
    commissionAmount: null,
    payableAmount: null,
    paymentTermsDays: null,
    termsSpecified: null,
    dueAt: null,
  };
}

export function statementReconciles(totals: StatementTotals) {
  return sumMoney([totals.payableCommission, totals.payableAmount]) === totals.payableGross;
}
