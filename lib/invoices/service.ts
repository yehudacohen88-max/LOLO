import { isDemoMoney } from "./demo-order";
import { DocumentConfigError, assertDocumentSettings } from "./settings";
import { sealSimulatedBody, splitVat, TEST_DOCUMENT_WATERMARK } from "./render";
import type {
  DocumentOrder,
  DocumentProvider,
  DocumentSettings,
  DocumentStore,
  StoredDocument,
} from "./types";

const REFUSED = "ספק המסמכים אינו מחובר. לא הופק מסמך.";

function assertSimulatedProvider(provider: DocumentProvider) {
  if (!provider.isSimulated || provider.name !== "simulated") {
    throw new DocumentConfigError(REFUSED);
  }
}

function forceSimulated(provider: DocumentProvider, demoOrder: boolean, reported: boolean) {
  if (provider.isSimulated || demoOrder) {
    return true;
  }
  return reported;
}

export async function issueOrderDocument(
  order: DocumentOrder,
  settings: DocumentSettings,
  deps: { store: DocumentStore; provider: DocumentProvider },
): Promise<StoredDocument> {
  const ready = assertDocumentSettings(settings);
  assertSimulatedProvider(deps.provider);

  const existing = await deps.store.findOpen(order.id, ready.documentKind);
  if (existing) {
    return existing;
  }

  const demoOrder = isDemoMoney(order);
  const amounts = splitVat(order.chargedAmount, ready.vatRatePercent, ready.vatIncluded);
  const issued = await deps.provider.issue({
    order,
    settings: ready,
    amounts,
    demoOrder,
    kind: ready.documentKind,
  });
  const simulated = forceSimulated(deps.provider, demoOrder, issued.simulated);
  if (!simulated) {
    throw new DocumentConfigError(REFUSED);
  }

  return deps.store.insert({
    orderId: order.id,
    orderRef: order.id,
    settlementId: order.settlementId ?? null,
    paymentReference: order.paymentReference,
    kind: ready.documentKind,
    provider: deps.provider.name,
    externalId: issued.externalId,
    simulated: true,
    demoOrder,
    watermark: TEST_DOCUMENT_WATERMARK,
    body: sealSimulatedBody(issued.body),
    vatRatePercent: ready.vatRatePercent,
    vatIncluded: ready.vatIncluded,
    currency: ready.currency,
    amountNet: amounts.net,
    amountVat: amounts.vat,
    amountGross: amounts.gross,
    status: "issued",
    relatedDocumentId: null,
  });
}

export async function creditDocument(
  documentId: string,
  deps: { store: DocumentStore; provider: DocumentProvider; order?: DocumentOrder | null },
): Promise<StoredDocument> {
  assertSimulatedProvider(deps.provider);
  const original = await deps.store.findById(documentId);
  if (!original) {
    throw new DocumentConfigError("המסמך לא נמצא.");
  }
  if (original.kind === "credit") {
    throw new DocumentConfigError("אי אפשר לזכות מסמך זיכוי.");
  }

  const existing = await deps.store.findCredit(original.id);
  if (existing) {
    if (original.status === "issued") {
      await deps.store.markCancelled(original.id);
    }
    return existing;
  }

  const issued = await deps.provider.cancel({
    original,
    order: deps.order ?? null,
  });
  const simulated = forceSimulated(deps.provider, original.demoOrder || original.simulated, issued.simulated);
  if (!simulated) {
    throw new DocumentConfigError(REFUSED);
  }

  const credit = await deps.store.insert({
    orderId: original.orderId,
    orderRef: original.orderRef,
    settlementId: original.settlementId,
    paymentReference: original.paymentReference,
    kind: "credit",
    provider: deps.provider.name,
    externalId: issued.externalId,
    simulated: true,
    demoOrder: original.demoOrder,
    watermark: TEST_DOCUMENT_WATERMARK,
    body: sealSimulatedBody(issued.body),
    vatRatePercent: original.vatRatePercent,
    vatIncluded: original.vatIncluded,
    currency: original.currency,
    amountNet: original.amountNet,
    amountVat: original.amountVat,
    amountGross: original.amountGross,
    status: "issued",
    relatedDocumentId: original.id,
  });

  if (original.status === "issued") {
    await deps.store.markCancelled(original.id);
  }
  return credit;
}
