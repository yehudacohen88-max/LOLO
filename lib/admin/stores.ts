import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { AdminStore, AdminStoreInput, SettlementMethod } from "./store-fields";
import { SETTLEMENT_METHODS } from "./store-fields";

const STORE_COLUMNS =
  "id, name, slug, active, logo_url, website_url, contact_name, contact_phone, contact_email, commission_percent, payment_terms_days, settlement_method, voucher_redemption_method, voucher_validity_days, allow_partial_redemption, allow_customer_topup, notes, created_at, updated_at";

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  logo_url: string | null;
  website_url: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  commission_percent: number | string | null;
  payment_terms_days: number | null;
  settlement_method: string | null;
  voucher_redemption_method: string | null;
  voucher_validity_days: number | null;
  allow_partial_redemption: boolean | null;
  allow_customer_topup: boolean | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function asSettlement(value: string | null): SettlementMethod | null {
  if (!value) {
    return null;
  }
  return SETTLEMENT_METHODS.includes(value as SettlementMethod)
    ? (value as SettlementMethod)
    : null;
}

function toAdminStore(row: StoreRow): AdminStore {
  const commission =
    row.commission_percent == null ? null : Number(row.commission_percent);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.active === true,
    logoUrl: row.logo_url,
    websiteUrl: row.website_url,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    commissionPercent: Number.isFinite(commission) ? commission : null,
    paymentTermsDays: row.payment_terms_days,
    settlementMethod: asSettlement(row.settlement_method),
    voucherRedemptionMethod: row.voucher_redemption_method,
    voucherValidityDays: row.voucher_validity_days,
    allowPartialRedemption: row.allow_partial_redemption,
    allowCustomerTopup: row.allow_customer_topup,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: AdminStoreInput) {
  return {
    name: input.name,
    slug: input.slug,
    active: input.active,
    logo_url: input.logoUrl,
    website_url: input.websiteUrl,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
    contact_email: input.contactEmail,
    commission_percent: input.commissionPercent,
    payment_terms_days: input.paymentTermsDays,
    settlement_method: input.settlementMethod,
    voucher_redemption_method: input.voucherRedemptionMethod,
    voucher_validity_days: input.voucherValidityDays,
    allow_partial_redemption: input.allowPartialRedemption,
    allow_customer_topup: input.allowCustomerTopup,
    notes: input.notes,
  };
}

function storeError(error: { message: string; code?: string }, fallback: string) {
  console.error("[LOLO] admin stores", {
    message: error.message,
    code: error.code,
  });
  if (error.code === "23505") {
    return new Error("המזהה באנגלית כבר בשימוש.");
  }
  if (error.code === "42703" || error.code === "PGRST204") {
    return new Error("עדכון טבלת בתי העסק עדיין לא הורץ.");
  }
  return new Error(fallback);
}

export async function listAdminStores(): Promise<AdminStore[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .select(STORE_COLUMNS)
    .order("name", { ascending: true });

  if (error) {
    throw storeError(error, "טעינת בתי העסק נכשלה.");
  }

  return ((data ?? []) as StoreRow[]).map(toAdminStore);
}

export async function getAdminStore(id: string): Promise<AdminStore | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .select(STORE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw storeError(error, "טעינת בית העסק נכשלה.");
  }
  return data ? toAdminStore(data as StoreRow) : null;
}

export async function createAdminStore(input: AdminStoreInput): Promise<AdminStore> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .insert(toRow(input))
    .select(STORE_COLUMNS)
    .single();

  if (error || !data) {
    throw storeError(error ?? { message: "empty" }, "שמירת בית העסק נכשלה.");
  }
  return toAdminStore(data as StoreRow);
}

export async function updateAdminStore(
  id: string,
  input: AdminStoreInput,
): Promise<AdminStore> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .update(toRow(input))
    .eq("id", id)
    .select(STORE_COLUMNS)
    .maybeSingle();

  if (error) {
    throw storeError(error, "עדכון בית העסק נכשל.");
  }
  if (!data) {
    throw new Error("בית העסק לא נמצא.");
  }
  return toAdminStore(data as StoreRow);
}

export async function setAdminStoreActive(id: string, active: boolean) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .update({ active })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw storeError(error, "עדכון הסטטוס נכשל.");
  }
  if (!data) {
    throw new Error("בית העסק לא נמצא.");
  }
}

export async function countStoresByStatus() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from("stores").select("active");
  if (error) {
    throw storeError(error, "טעינת בתי העסק נכשלה.");
  }
  const rows = data ?? [];
  return {
    active: rows.filter((row) => row.active === true).length,
    inactive: rows.filter((row) => row.active !== true).length,
  };
}

async function countRows(table: "events" | "orders" | "event_gifts") {
  const supabase = getSupabaseServiceClient();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) {
    console.error("[LOLO] admin count", { table, message: error.message, code: error.code });
    throw new Error("טעינת הנתונים נכשלה.");
  }
  return count ?? 0;
}

export async function countEvents() {
  return countRows("events");
}

export async function countOrders() {
  return countRows("orders");
}

export async function countGifts() {
  return countRows("event_gifts");
}
