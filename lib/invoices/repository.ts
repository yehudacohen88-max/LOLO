import "server-only";
import { orderMoneyFromRow } from "@/lib/payments/fee";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  rethrowIfNotificationSchema,
  unavailableError,
} from "@/lib/notifications/schema-error";
import { TEST_DOCUMENT_WATERMARK } from "./render";
import { parseDocumentSettings } from "./settings";
import type {
  DocumentKind,
  DocumentOrder,
  DocumentSettings,
  DocumentStore,
  NewDocument,
  StoredDocument,
} from "./types";
import { DOCUMENT_KINDS } from "./types";

type DocumentRow = {
  id: string;
  order_id: string | null;
  order_ref: string;
  settlement_id: string | null;
  payment_reference: string | null;
  kind: string;
  provider: string;
  external_id: string;
  simulated: boolean;
  demo_order: boolean;
  watermark: string;
  body: string;
  vat_rate_percent: number | string;
  vat_included: boolean;
  currency: string;
  amount_net: number | string;
  amount_vat: number | string;
  amount_gross: number | string;
  status: string;
  related_document_id: string | null;
  created_at: string;
  updated_at: string;
};

function isKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

function money(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapDocument(row: DocumentRow): StoredDocument | null {
  if (!isKind(row.kind) || (row.status !== "issued" && row.status !== "cancelled")) {
    return null;
  }
  return {
    id: row.id,
    orderId: row.order_id,
    orderRef: row.order_ref,
    settlementId: row.settlement_id,
    paymentReference: row.payment_reference,
    kind: row.kind,
    provider: row.provider,
    externalId: row.external_id,
    simulated: row.simulated === true,
    demoOrder: row.demo_order === true,
    watermark: row.watermark,
    body: row.body,
    vatRatePercent: money(row.vat_rate_percent),
    vatIncluded: row.vat_included === true,
    currency: row.currency,
    amountNet: money(row.amount_net),
    amountVat: money(row.amount_vat),
    amountGross: money(row.amount_gross),
    status: row.status,
    relatedDocumentId: row.related_document_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function throwQuery(error: { code?: string; message?: string }, label: string): never {
  rethrowIfNotificationSchema(error);
  console.error(`[LOLO] ${label}`, { code: error.code, message: error.message });
  throw unavailableError();
}

function toRow(document: NewDocument) {
  const simulated = document.provider === "simulated" || document.demoOrder ? true : document.simulated;
  return {
    order_id: document.orderId,
    order_ref: document.orderRef,
    settlement_id: document.settlementId,
    payment_reference: document.paymentReference,
    kind: document.kind,
    provider: document.provider,
    external_id: document.externalId,
    simulated,
    demo_order: document.demoOrder,
    watermark: simulated ? TEST_DOCUMENT_WATERMARK : document.watermark,
    body: document.body,
    vat_rate_percent: document.vatRatePercent,
    vat_included: document.vatIncluded,
    currency: document.currency,
    amount_net: document.amountNet,
    amount_vat: document.amountVat,
    amount_gross: document.amountGross,
    status: document.status,
    related_document_id: document.relatedDocumentId,
  };
}

export class SupabaseDocumentStore implements DocumentStore {
  async findOpen(orderId: string, kind: "receipt" | "invoice") {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("order_id", orderId)
      .eq("kind", kind)
      .eq("status", "issued")
      .maybeSingle();
    if (error) {
      throwQuery(error, "document lookup failed");
    }
    return data ? mapDocument(data as DocumentRow) : null;
  }

  async findCredit(originalId: string) {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("related_document_id", originalId)
      .eq("kind", "credit")
      .maybeSingle();
    if (error) {
      throwQuery(error, "credit lookup failed");
    }
    return data ? mapDocument(data as DocumentRow) : null;
  }

  async findById(id: string) {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
    if (error) {
      throwQuery(error, "document read failed");
    }
    return data ? mapDocument(data as DocumentRow) : null;
  }

  async insert(document: NewDocument) {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("documents")
      .insert(toRow(document))
      .select("*")
      .maybeSingle();
    if (error?.code === "23505") {
      if (document.kind === "credit" && document.relatedDocumentId) {
        const credit = await this.findCredit(document.relatedDocumentId);
        if (credit) {
          return credit;
        }
      }
      if (
        document.orderId &&
        (document.kind === "receipt" || document.kind === "invoice")
      ) {
        const open = await this.findOpen(document.orderId, document.kind);
        if (open) {
          return open;
        }
      }
    }
    if (error) {
      throwQuery(error, "document insert failed");
    }
    const mapped = data ? mapDocument(data as DocumentRow) : null;
    if (!mapped || (document.provider === "simulated" && !mapped.simulated)) {
      throw unavailableError();
    }
    return mapped;
  }

  async markCancelled(id: string) {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("documents")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      throwQuery(error, "document cancel failed");
    }
    const mapped = data ? mapDocument(data as DocumentRow) : null;
    if (!mapped) {
      throw unavailableError();
    }
    return mapped;
  }

  async list(query: { limit: number; orderId?: string }) {
    const supabase = getSupabaseServiceClient();
    let request = supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(query.limit);
    if (query.orderId) {
      request = request.eq("order_id", query.orderId);
    }
    const { data, error } = await request;
    if (error) {
      throwQuery(error, "document list failed");
    }
    return ((data ?? []) as DocumentRow[])
      .map(mapDocument)
      .filter((row): row is StoredDocument => row !== null);
  }
}

export async function loadDocumentSettings(): Promise<DocumentSettings> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("vat_rate_percent, vat_included, default_document_kind, document_currency")
    .eq("id", "default")
    .maybeSingle();
  if (error) {
    throwQuery(error, "document settings read failed");
  }
  return parseDocumentSettings(
    (data ?? null) as {
      vat_rate_percent?: number | string | null;
      vat_included?: boolean | null;
      default_document_kind?: string | null;
      document_currency?: string | null;
    } | null,
  );
}

export async function loadDocumentOrder(orderId: string): Promise<DocumentOrder | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, event_id, guest_name, total_amount, fee_amount, charged_amount, payment_status, payment_provider, payment_reference",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) {
    throwQuery(error, "document order read failed");
  }
  if (!data) {
    return null;
  }
  const order = data as {
    id: string;
    event_id: string;
    guest_name: string;
    total_amount?: number | string | null;
    fee_amount?: number | string | null;
    charged_amount?: number | string | null;
    payment_status: string;
    payment_provider?: string | null;
    payment_reference?: string | null;
  };
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("title")
    .eq("id", order.event_id)
    .maybeSingle();
  if (eventError) {
    throwQuery(eventError, "document event read failed");
  }
  const money = orderMoneyFromRow(order);
  return {
    id: order.id,
    eventTitle: ((event ?? null) as { title?: string } | null)?.title ?? "",
    guestName: order.guest_name ?? "",
    contributionAmount: money.contributionAmount,
    feeAmount: money.feeAmount,
    chargedAmount: money.chargedAmount,
    paymentProvider: order.payment_provider ?? null,
    paymentReference: order.payment_reference ?? null,
    paymentStatus: order.payment_status,
  };
}

export async function listDocuments(query: { limit: number; orderId?: string }) {
  return new SupabaseDocumentStore().list(query);
}
