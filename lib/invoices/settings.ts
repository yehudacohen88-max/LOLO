import type { DocumentSettings, ReadyDocumentSettings } from "./types";

export class DocumentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentConfigError";
  }
}

export function emptyDocumentSettings(): DocumentSettings {
  return {
    vatRatePercent: null,
    vatIncluded: null,
    documentKind: null,
    currency: null,
  };
}

export function parseDocumentSettings(row: {
  vat_rate_percent?: number | string | null;
  vat_included?: boolean | null;
  default_document_kind?: string | null;
  document_currency?: string | null;
} | null): DocumentSettings {
  if (!row) {
    return emptyDocumentSettings();
  }

  const rateMissing = row.vat_rate_percent == null || row.vat_rate_percent === "";
  const rate = rateMissing ? null : Number(row.vat_rate_percent);
  const kind =
    row.default_document_kind === "receipt" || row.default_document_kind === "invoice"
      ? row.default_document_kind
      : null;
  const currency =
    typeof row.document_currency === "string" ? row.document_currency.trim().toUpperCase() : "";

  return {
    vatRatePercent: rate != null && Number.isFinite(rate) ? rate : null,
    vatIncluded: typeof row.vat_included === "boolean" ? row.vat_included : null,
    documentKind: kind,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
  };
}

/**
 * Refuses to invent a rate, a tax treatment, a document type, or a currency.
 * A missing value stays missing.
 */
export function assertDocumentSettings(settings: DocumentSettings): ReadyDocumentSettings {
  const missing: string[] = [];
  if (
    settings.vatRatePercent == null ||
    !Number.isFinite(settings.vatRatePercent) ||
    settings.vatRatePercent < 0 ||
    settings.vatRatePercent > 100
  ) {
    missing.push("שיעור המע״מ");
  }
  if (settings.vatIncluded == null) {
    missing.push("האם המחיר כולל מע״מ");
  }
  if (settings.documentKind == null) {
    missing.push("סוג המסמך");
  }
  if (settings.currency == null) {
    missing.push("המטבע");
  }
  if (missing.length > 0) {
    throw new DocumentConfigError(`חסרה הגדרה: ${missing.join(", ")}. לא הופק מסמך.`);
  }

  return {
    vatRatePercent: settings.vatRatePercent as number,
    vatIncluded: settings.vatIncluded as boolean,
    documentKind: settings.documentKind as "receipt" | "invoice",
    currency: settings.currency as string,
  };
}
