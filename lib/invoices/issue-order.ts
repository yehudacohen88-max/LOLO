import "server-only";
import { DocumentConfigError } from "./settings";
import { createDocumentProvider } from "./providers";
import { loadDocumentOrder, loadDocumentSettings, SupabaseDocumentStore } from "./repository";
import { creditDocument, issueOrderDocument } from "./service";

let store: SupabaseDocumentStore | null = null;

function documents() {
  store ??= new SupabaseDocumentStore();
  return store;
}

/** Issues the configured document type for an order. Never calls a live provider. */
export async function issueDocumentForOrder(orderId: string) {
  const order = await loadDocumentOrder(orderId);
  if (!order) {
    throw new DocumentConfigError("ההזמנה לא נמצאה.");
  }
  const settings = await loadDocumentSettings();
  return issueOrderDocument(order, settings, {
    store: documents(),
    provider: createDocumentProvider(),
  });
}

/** Writes a simulated credit and marks the original cancelled. */
export async function creditDocumentById(documentId: string) {
  return creditDocument(documentId, {
    store: documents(),
    provider: createDocumentProvider(),
  });
}
