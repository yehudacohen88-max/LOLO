export const DOCUMENT_KINDS = ["receipt", "invoice", "credit"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export type DocumentSettings = {
  vatRatePercent: number | null;
  vatIncluded: boolean | null;
  documentKind: "receipt" | "invoice" | null;
  currency: string | null;
};

export type ReadyDocumentSettings = {
  vatRatePercent: number;
  vatIncluded: boolean;
  documentKind: "receipt" | "invoice";
  currency: string;
};

export type DocumentOrder = {
  id: string;
  eventTitle: string;
  guestName: string;
  contributionAmount: number;
  feeAmount: number;
  chargedAmount: number;
  paymentProvider: string | null;
  paymentReference: string | null;
  paymentStatus: string;
  settlementId?: string | null;
};

export type VatSplit = {
  net: number;
  vat: number;
  gross: number;
};

export type IssueDocumentRequest = {
  order: DocumentOrder;
  settings: ReadyDocumentSettings;
  amounts: VatSplit;
  demoOrder: boolean;
  kind: "receipt" | "invoice";
};

export type CreditDocumentRequest = {
  original: StoredDocument;
  order: DocumentOrder | null;
};

export type ProviderDocument = {
  externalId: string;
  body: string;
  watermark: string;
  simulated: boolean;
};

/**
 * issue creates a receipt or invoice. cancel creates a credit linked to it.
 * Live adapters are not implemented. A real provider name fails closed.
 */
export interface DocumentProvider {
  readonly name: string;
  readonly isSimulated: boolean;
  issue(request: IssueDocumentRequest): Promise<ProviderDocument>;
  cancel(request: CreditDocumentRequest): Promise<ProviderDocument>;
}

export type StoredDocument = {
  id: string;
  orderId: string | null;
  orderRef: string;
  settlementId: string | null;
  paymentReference: string | null;
  kind: DocumentKind;
  provider: string;
  externalId: string;
  simulated: boolean;
  demoOrder: boolean;
  watermark: string;
  body: string;
  vatRatePercent: number;
  vatIncluded: boolean;
  currency: string;
  amountNet: number;
  amountVat: number;
  amountGross: number;
  status: "issued" | "cancelled";
  relatedDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewDocument = Omit<StoredDocument, "id" | "createdAt" | "updatedAt">;

export interface DocumentStore {
  findOpen(orderId: string, kind: "receipt" | "invoice"): Promise<StoredDocument | null>;
  findCredit(originalId: string): Promise<StoredDocument | null>;
  findById(id: string): Promise<StoredDocument | null>;
  insert(document: NewDocument): Promise<StoredDocument>;
  markCancelled(id: string): Promise<StoredDocument>;
  list(query: { limit: number; orderId?: string }): Promise<StoredDocument[]>;
}
