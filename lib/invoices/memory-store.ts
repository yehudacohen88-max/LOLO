import { randomUUID } from "node:crypto";
import { TEST_DOCUMENT_WATERMARK } from "./render";
import type { DocumentStore, NewDocument, StoredDocument } from "./types";

export class MemoryDocumentStore implements DocumentStore {
  readonly rows: StoredDocument[] = [];

  private seal(document: NewDocument): NewDocument {
    if (document.provider === "simulated" && document.simulated !== true) {
      throw new Error("ספק ההדגמה לא יכול לשמור מסמך שאינו מסומן כהדגמה.");
    }
    if (document.demoOrder && document.simulated !== true) {
      throw new Error("מסמך של הזמנת הדגמה חייב להיות מסומן כהדגמה.");
    }
    if (document.simulated && document.watermark !== TEST_DOCUMENT_WATERMARK) {
      throw new Error("חסרה חותמת מסמך הבדיקה.");
    }
    return document;
  }

  async findOpen(orderId: string, kind: "receipt" | "invoice") {
    return (
      this.rows.find(
        (row) => row.orderId === orderId && row.kind === kind && row.status === "issued",
      ) ?? null
    );
  }

  async findCredit(originalId: string) {
    return (
      this.rows.find((row) => row.kind === "credit" && row.relatedDocumentId === originalId) ?? null
    );
  }

  async findById(id: string) {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async insert(document: NewDocument) {
    const sealed = this.seal(document);
    const now = new Date().toISOString();
    const row: StoredDocument = {
      ...sealed,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return row;
  }

  async markCancelled(id: string) {
    const row = this.rows.find((item) => item.id === id);
    if (!row) {
      throw new Error("המסמך לא נמצא.");
    }
    row.status = "cancelled";
    row.updatedAt = new Date().toISOString();
    return row;
  }

  async list(query: { limit: number; orderId?: string }) {
    return this.rows
      .filter((row) => (query.orderId ? row.orderId === query.orderId : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, query.limit);
  }
}
