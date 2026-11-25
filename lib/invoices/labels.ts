import type { DocumentKind } from "./types";

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  receipt: "קבלה",
  invoice: "חשבונית",
  credit: "זיכוי",
};

export const DOCUMENT_STATUS_LABELS = {
  issued: "הופק",
  cancelled: "בוטל",
} as const;
