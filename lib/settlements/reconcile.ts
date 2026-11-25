import { sumMoney } from "@/lib/settlements/money";
import type { StatementRow } from "@/lib/settlements/statement";

export type ReconciliationSettlement = {
  id: string;
  storeId: string;
  storeName: string;
  status: string;
  grossAmount: number;
  commissionAmount: number;
  payableAmount: number;
  paymentReference: string | null;
  lineRedemptionIds: string[];
};

export type ReconciliationDiscrepancy = {
  kind: "amount" | "status" | "reference" | "demo" | "blocked";
  settlementId: string | null;
  storeName: string;
  detail: string;
  expected: number | null;
  recorded: number | null;
};

export type ReconciliationReport = {
  expectedOutstanding: number;
  markedPaid: number;
  settledFromLines: number;
  discrepancyCount: number;
  discrepancies: ReconciliationDiscrepancy[];
};

const MONEY_KINDS = new Set(["amount"]);

export function buildReconciliation(
  rows: StatementRow[],
  settlements: ReconciliationSettlement[],
): ReconciliationReport {
  const discrepancies: ReconciliationDiscrepancy[] = [];
  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const row of rows) {
    if (row.section === "demo" && row.settlementStatus && row.settlementStatus !== "UNSETTLED") {
      discrepancies.push({
        kind: "demo",
        settlementId: row.settlementId,
        storeName: row.storeName,
        detail: "מימוש הדגמה נמצא מחוץ למצב שטרם הוסדר.",
        expected: null,
        recorded: row.grossAmount,
      });
    }
    if (row.section === "demo" && row.settlementId) {
      discrepancies.push({
        kind: "demo",
        settlementId: row.settlementId,
        storeName: row.storeName,
        detail: "מימוש הדגמה נכנס להתחשבנות.",
        expected: null,
        recorded: row.grossAmount,
      });
    }
    if (row.section === "blocked") {
      discrepancies.push({
        kind: "blocked",
        settlementId: null,
        storeName: row.storeName,
        detail:
          row.blockedReason === "terms"
            ? "אין ימי תשלום למימוש, ואין ברירת מחדל בהגדרות."
            : row.blockedReason === "rounding"
              ? "כלל העיגול לא הוגדר בהגדרות."
              : "אין אחוז עמלה למימוש, ואין ברירת מחדל בהגדרות.",
        expected: null,
        recorded: null,
      });
    }
  }

  let markedPaid = 0;
  let settledFromLines = 0;
  const paidLineIds = new Set<string>();

  for (const settlement of settlements) {
    const lines = settlement.lineRedemptionIds.map((id) => byId.get(id)).filter((row) => row != null);
    const lineGross = sumMoney(lines.map((row) => row.grossAmount));
    const lineCommission = sumMoney(lines.map((row) => row.commissionAmount ?? 0));
    const linePayable = sumMoney(lines.map((row) => row.payableAmount ?? 0));
    if (
      lines.length !== settlement.lineRedemptionIds.length ||
      lineGross !== settlement.grossAmount ||
      lineCommission !== settlement.commissionAmount ||
      linePayable !== settlement.payableAmount
    ) {
      discrepancies.push({
        kind: "amount",
        settlementId: settlement.id,
        storeName: settlement.storeName,
        detail: "סכום השורות אינו שווה לסכום שנשמר על ההתחשבנות.",
        expected: linePayable,
        recorded: settlement.payableAmount,
      });
    }

    if (settlement.status === "PAID") {
      markedPaid = sumMoney([markedPaid, settlement.payableAmount]);
      settledFromLines = sumMoney([settledFromLines, linePayable]);
      for (const id of settlement.lineRedemptionIds) {
        paidLineIds.add(id);
        const row = byId.get(id);
        if (!row || row.settlementStatus !== "SETTLED") {
          discrepancies.push({
            kind: "status",
            settlementId: settlement.id,
            storeName: settlement.storeName,
            detail: "שורה בהתחשבנות שסומנה כשולמה אינה על מימוש במצב הוסדר.",
            expected: null,
            recorded: null,
          });
        }
        if (row?.section === "demo") {
          discrepancies.push({
            kind: "demo",
            settlementId: settlement.id,
            storeName: settlement.storeName,
            detail: "התחשבנות שסומנה כשולמה כוללת מימוש הדגמה.",
            expected: null,
            recorded: row.grossAmount,
          });
        }
      }
      if (!settlement.paymentReference) {
        discrepancies.push({
          kind: "reference",
          settlementId: settlement.id,
          storeName: settlement.storeName,
          detail: "סומן כשולם בלי אסמכתה.",
          expected: settlement.payableAmount,
          recorded: null,
        });
      }
    }
  }

  for (const row of rows) {
    if (row.section === "payable" && row.settlementStatus === "SETTLED" && !paidLineIds.has(row.id)) {
      discrepancies.push({
        kind: "status",
        settlementId: row.settlementId,
        storeName: row.storeName,
        detail: "מימוש במצב הוסדר אינו על התחשבנות שסומנה כשולמה.",
        expected: row.payableAmount,
        recorded: null,
      });
    }
  }

  const expectedOutstanding = sumMoney(
    rows.flatMap((row) =>
      row.section === "payable" &&
      (row.settlementStatus === "UNSETTLED" || row.settlementStatus === "SETTLEMENT_PENDING")
        ? [row.payableAmount ?? 0]
        : [],
    ),
  );

  return {
    expectedOutstanding,
    markedPaid,
    settledFromLines,
    discrepancyCount: discrepancies.length,
    discrepancies,
  };
}

export function reconciliationBalances(report: ReconciliationReport) {
  return (
    report.discrepancies.filter((item) => MONEY_KINDS.has(item.kind)).length === 0 &&
    report.markedPaid === report.settledFromLines
  );
}
