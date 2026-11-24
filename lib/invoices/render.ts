import { roundMoney } from "@/lib/money";
import type { CreditDocumentRequest, DocumentKind, IssueDocumentRequest, VatSplit } from "./types";

export const TEST_DOCUMENT_WATERMARK = "מסמך בדיקה – אינו מסמך חשבונאי";

const KIND_LABEL: Record<DocumentKind, string> = {
  receipt: "קבלה",
  invoice: "חשבונית",
  credit: "זיכוי",
};

export function splitVat(baseAmount: number, ratePercent: number, included: boolean): VatSplit {
  const baseAgorot = Math.round(roundMoney(baseAmount) * 100);
  if (included) {
    const vatAgorot = Math.round((baseAgorot * ratePercent) / (100 + ratePercent));
    const netAgorot = baseAgorot - vatAgorot;
    return {
      net: netAgorot / 100,
      vat: vatAgorot / 100,
      gross: baseAgorot / 100,
    };
  }
  const vatAgorot = Math.round((baseAgorot * ratePercent) / 100);
  return {
    net: baseAgorot / 100,
    vat: vatAgorot / 100,
    gross: (baseAgorot + vatAgorot) / 100,
  };
}

function money(value: number, currency: string) {
  const digits = roundMoney(value).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${digits} ${currency}`;
}

function rateLabel(rate: number) {
  const rounded = Math.round(rate * 1000) / 1000;
  return String(rounded);
}

export function renderIssuedDocument(request: IssueDocumentRequest, externalId: string) {
  const { order, settings, amounts, demoOrder, kind } = request;
  const lines = [
    TEST_DOCUMENT_WATERMARK,
    "",
    `סוג: ${KIND_LABEL[kind]}`,
    `מזהה בדיקה: ${externalId}`,
    `הזמנה: ${order.id}`,
    `תשלום: ${order.paymentReference?.trim() || "—"}`,
    `אורח: ${order.guestName}`,
    `אירוע: ${order.eventTitle}`,
    `סכום לפני מע״מ: ${money(amounts.net, settings.currency)}`,
    `שיעור מע״מ: ${rateLabel(settings.vatRatePercent)}%`,
    `מע״מ כלול במחיר: ${settings.vatIncluded ? "כן" : "לא"}`,
    `סכום מע״מ: ${money(amounts.vat, settings.currency)}`,
    `סכום כולל: ${money(amounts.gross, settings.currency)}`,
    `מטבע: ${settings.currency}`,
    `הזמנת הדגמה: ${demoOrder ? "כן" : "לא"}`,
    "simulated: true",
    "",
    TEST_DOCUMENT_WATERMARK,
  ];
  return lines.join("\n");
}

export function renderCreditDocument(request: CreditDocumentRequest, externalId: string) {
  const original = request.original;
  const lines = [
    TEST_DOCUMENT_WATERMARK,
    "",
    `סוג: ${KIND_LABEL.credit}`,
    `מזהה בדיקה: ${externalId}`,
    `מבטל את המסמך: ${original.externalId}`,
    `הזמנה: ${original.orderRef}`,
    `שיעור מע״מ: ${rateLabel(original.vatRatePercent)}%`,
    `סכום כולל לזיכוי: ${money(original.amountGross, original.currency)}`,
    "simulated: true",
    "",
    TEST_DOCUMENT_WATERMARK,
  ];
  return lines.join("\n");
}

export function sealSimulatedBody(body: string) {
  if (body.includes(TEST_DOCUMENT_WATERMARK)) {
    return body;
  }
  return `${TEST_DOCUMENT_WATERMARK}\n${body}\n${TEST_DOCUMENT_WATERMARK}`;
}
