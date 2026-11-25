import { DEMO_REDEMPTION_LABEL } from "@/lib/settlements/labels";
import type { StoreTransactionPage } from "@/lib/desk/transactions";

const HEADERS = [
  "מועד",
  "שובר",
  "מתנה",
  "אירוע",
  "סכום שמומש",
  "סיווג",
  "ערוץ",
  "אסמכתה",
  "סטטוס התחשבנות",
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

function classification(page: StoreTransactionPage, demoOnly: boolean | null) {
  if (!page.classificationAvailable || demoOnly == null) {
    return "לא זמין";
  }
  return demoOnly ? DEMO_REDEMPTION_LABEL : "אינו הדגמה";
}

export function storeTransactionsCsv(page: StoreTransactionPage) {
  const lines = [
    HEADERS.map(csvCell).join(","),
    ...page.rows.map((row) =>
      [
        row.redeemedAt,
        row.voucherCode,
        row.giftTitle,
        row.eventTitle,
        row.amount,
        classification(page, row.demoOnly),
        row.channel,
        row.reference,
        row.settlementStatus,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  lines.push(
    [
      "סכום מימושים שאינם הדגמה (לפני עמלה)",
      "",
      "",
      "",
      page.standardGross ?? "",
      page.classificationAvailable ? "אינו הדגמה" : "לא זמין",
      "",
      "",
      "",
    ]
      .map(csvCell)
      .join(","),
  );
  if (page.classificationAvailable) {
    lines.push(
      [DEMO_REDEMPTION_LABEL, "", "", "", page.demoGross ?? 0, DEMO_REDEMPTION_LABEL, "", "", ""]
        .map(csvCell)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
