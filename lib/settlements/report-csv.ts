import type { StatementRow } from "@/lib/settlements/statement";

const HEADERS = [
  "סוג",
  "בית עסק",
  "סטטוס התחשבנות",
  "שובר",
  "מתנה",
  "אירוע",
  "סכום שמומש",
  "אחוז עמלה",
  "מקור עמלה",
  "סכום עמלה",
  "לתשלום",
  "ימי תשלום",
  "מקור תנאי תשלום",
  "מועד מימוש",
  "תאריך יעד",
  "סומן כשולם",
  "אסמכתה",
  "אופן תשלום",
];

function csvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function sectionLabel(row: StatementRow) {
  if (row.section === "demo") {
    return "הדגמה — לא לתשלום";
  }
  if (row.section === "blocked") {
    return "חסום — לא לתשלום";
  }
  return "לתשלום";
}

function sourceLabel(specified: boolean | null) {
  if (specified == null) {
    return "";
  }
  return specified ? "נשמר במימוש" : "ברירת מחדל בהגדרות";
}

export function settlementReportCsv(rows: StatementRow[]) {
  const lines = [
    HEADERS.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        sectionLabel(row),
        row.storeName,
        row.settlementStatus ?? "",
        row.voucherCode,
        row.giftTitle,
        row.eventTitle,
        row.grossAmount,
        row.section === "payable" ? row.commissionPercent : "",
        sourceLabel(row.commissionSpecified),
        row.section === "payable" ? row.commissionAmount : "",
        row.section === "payable" ? row.payableAmount : "",
        row.section === "payable" ? row.paymentTermsDays : "",
        sourceLabel(row.termsSpecified),
        row.redeemedAt,
        row.dueAt ?? "",
        row.paidAt ?? "",
        row.paymentReference ?? "",
        row.paymentMethod ?? "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export const DEMO_SECTION_LABEL = "הדגמה — לא לתשלום";
