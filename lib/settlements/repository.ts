import "server-only";
import { SETTLEMENT_METHODS, type SettlementMethod } from "@/lib/admin/store-fields";
import {
  countEvents,
  countGifts,
  countOrders,
  countStoresByStatus,
  listAdminStores,
} from "@/lib/admin/stores";
import { roundMoney } from "@/lib/money";
import { buildFinanceOverview, buildStoreBalances } from "@/lib/settlements/overview";
import {
  isMissingSettlementSchema,
  settlementErrorCode,
  settlementErrorMessage,
  settlementErrorStatus,
  SettlementActionError,
  SettlementSchemaMissingError,
} from "@/lib/settlements/messages";
import { isSettlementOverdue } from "@/lib/settlements/money";
import {
  asSettlementStatus,
  type SettlementCommandResult,
  type SettlementDetail,
  type SettlementLineView,
  type SettlementListItem,
  type SettlementStatus,
} from "@/lib/settlements/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const SETTLEMENT_COLUMNS =
  "id, store_id, status, store_name, settlement_method, gross_amount, commission_amount, payable_amount, due_at, paid_at, payment_reference, payment_method, cancelled_at, created_at";

const LINE_COLUMNS =
  "id, settlement_id, redemption_id, voucher_id, gross_amount, commission_percent, commission_specified, commission_amount, payable_amount, payment_terms_days, terms_specified, redeemed_at, due_at, voucher_code, gift_title, event_title, released_at";

type SettlementRow = {
  id: string;
  store_id: string;
  status: string;
  store_name: string;
  settlement_method: string | null;
  gross_amount: number | string;
  commission_amount: number | string;
  payable_amount: number | string;
  due_at: string;
  paid_at: string | null;
  payment_reference: string | null;
  payment_method: string | null;
  cancelled_at: string | null;
  created_at: string;
};

type LineRow = {
  id: string;
  settlement_id: string;
  redemption_id: string;
  voucher_id: string;
  gross_amount: number | string;
  commission_percent: number | string;
  commission_specified: boolean;
  commission_amount: number | string;
  payable_amount: number | string;
  payment_terms_days: number;
  terms_specified: boolean;
  redeemed_at: string;
  due_at: string;
  voucher_code: string;
  gift_title: string;
  event_title: string;
  released_at: string | null;
};

type DbError = { message: string; code?: string };

const schemaLogged = new Set<string>();

function money(value: number | string | null | undefined) {
  return roundMoney(Number(value) || 0);
}

function asMethod(value: string | null): SettlementMethod | null {
  if (!value) {
    return null;
  }
  return SETTLEMENT_METHODS.includes(value as SettlementMethod)
    ? (value as SettlementMethod)
    : null;
}

function throwSettlementDbError(error: DbError): never {
  const key = `${error.code ?? ""}:${error.message}`;
  if (!schemaLogged.has(key)) {
    schemaLogged.add(key);
    console.error("[LOLO] settlement", { code: error.code, message: error.message });
  }
  if (isMissingSettlementSchema(error)) {
    console.error(
      "[LOLO] Settlement schema is missing. Run supabase/settlements.sql after supabase/vouchers.sql.",
    );
    throw new SettlementSchemaMissingError();
  }
  const code = settlementErrorCode(error.message);
  if (code) {
    throw new SettlementActionError(settlementErrorMessage(code), settlementErrorStatus(code));
  }
  throw new SettlementActionError("לא הצלחנו להשלים את הפעולה. נסו שוב.");
}

function toListItem(row: SettlementRow, now: number): SettlementListItem {
  const status = asSettlementStatus(row.status);
  return {
    id: row.id,
    storeId: row.store_id,
    storeName: row.store_name || "בית עסק",
    status,
    grossAmount: money(row.gross_amount),
    commissionAmount: money(row.commission_amount),
    payableAmount: money(row.payable_amount),
    dueAt: row.due_at,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    paymentReference: row.payment_reference,
    paymentMethod: asMethod(row.payment_method),
    settlementMethod: asMethod(row.settlement_method),
    overdue: isSettlementOverdue(status, row.due_at, now),
  };
}

function toLine(row: LineRow): SettlementLineView {
  return {
    id: row.id,
    redemptionId: row.redemption_id,
    voucherId: row.voucher_id,
    voucherCode: row.voucher_code,
    giftTitle: row.gift_title || "מתנה",
    eventTitle: row.event_title,
    grossAmount: money(row.gross_amount),
    commissionPercent: money(row.commission_percent),
    commissionSpecified: row.commission_specified === true,
    commissionAmount: money(row.commission_amount),
    payableAmount: money(row.payable_amount),
    paymentTermsDays: row.payment_terms_days ?? 0,
    termsSpecified: row.terms_specified === true,
    redeemedAt: row.redeemed_at,
    dueAt: row.due_at,
  };
}

async function fetchPages<T>(
  load: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: DbError | null }>,
) {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let page = 0; page < 50; page += 1) {
    const from = page * pageSize;
    const { data, error } = await load(from, from + pageSize - 1);
    if (error) {
      throwSettlementDbError(error);
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) {
      return rows;
    }
  }
  return rows;
}

function commandFromPayload(data: unknown): SettlementCommandResult {
  const payload = data as { id?: string; status?: string; idempotent?: boolean } | null;
  if (!payload?.id) {
    throw new SettlementActionError("לא הצלחנו להשלים את הפעולה. נסו שוב.");
  }
  return {
    id: String(payload.id),
    status: asSettlementStatus(String(payload.status ?? "PENDING")),
    idempotent: payload.idempotent === true,
  };
}

export async function listSettlements(filters: {
  status?: SettlementStatus | "overdue" | "";
  storeId?: string;
}) {
  const supabase = getSupabaseServiceClient();
  const now = Date.now();
  let query = supabase
    .from("settlements")
    .select(SETTLEMENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(300);

  if (filters.storeId) {
    query = query.eq("store_id", filters.storeId);
  }
  if (filters.status === "overdue") {
    query = query.eq("status", "PENDING").lt("due_at", new Date(now).toISOString());
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) {
    throwSettlementDbError(error);
  }
  return ((data ?? []) as SettlementRow[]).map((row) => toListItem(row, now));
}

async function linesForSettlements(settlementIds: string[]) {
  if (settlementIds.length === 0) {
    return new Map<string, SettlementLineView[]>();
  }
  const supabase = getSupabaseServiceClient();
  const rows = await fetchPages<LineRow>((from, to) =>
    supabase
      .from("settlement_lines")
      .select(LINE_COLUMNS)
      .in("settlement_id", settlementIds)
      .order("redeemed_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  const grouped = new Map<string, SettlementLineView[]>();
  for (const row of rows) {
    const list = grouped.get(row.settlement_id) ?? [];
    list.push(toLine(row));
    grouped.set(row.settlement_id, list);
  }
  return grouped;
}

export async function getSettlement(id: string): Promise<SettlementDetail | null> {
  const supabase = getSupabaseServiceClient();
  const now = Date.now();
  const { data, error } = await supabase
    .from("settlements")
    .select(SETTLEMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throwSettlementDbError(error);
  }
  if (!data) {
    return null;
  }
  const lines = await linesForSettlements([id]);
  return {
    ...toListItem(data as SettlementRow, now),
    cancelledAt: (data as SettlementRow).cancelled_at,
    lines: lines.get(id) ?? [],
  };
}

export async function listStoreBalances() {
  const supabase = getSupabaseServiceClient();
  const stores = await listAdminStores();
  const redemptions = await fetchPages<{
    store_id: string;
    amount: number | string;
    commission_percent_snapshot: number | string | null;
  }>((from, to) =>
    supabase
      .from("redemptions")
      .select("store_id, amount, commission_percent_snapshot")
      .eq("settlement_status", "UNSETTLED")
      .order("id", { ascending: true })
      .range(from, to),
  );
  const settlements = await fetchPages<{
    store_id: string;
    status: string;
    payable_amount: number | string;
  }>((from, to) =>
    supabase
      .from("settlements")
      .select("store_id, status, payable_amount")
      .in("status", ["PENDING", "PAID"])
      .order("id", { ascending: true })
      .range(from, to),
  );

  return buildStoreBalances(
    stores.map((store) => ({ id: store.id, name: store.name })),
    redemptions.map((row) => ({
      storeId: row.store_id,
      amount: money(row.amount),
      commissionPercent:
        row.commission_percent_snapshot == null || row.commission_percent_snapshot === ""
          ? null
          : Number(row.commission_percent_snapshot),
    })),
    settlements.map((row) => ({
      storeId: row.store_id,
      status: row.status,
      payableAmount: money(row.payable_amount),
    })),
  );
}

export async function listStoreSettlementDetails(storeId: string): Promise<SettlementDetail[]> {
  const supabase = getSupabaseServiceClient();
  const now = Date.now();
  const { data, error } = await supabase
    .from("settlements")
    .select(SETTLEMENT_COLUMNS)
    .eq("store_id", storeId)
    .in("status", ["PENDING", "PAID"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    throwSettlementDbError(error);
  }
  const rows = (data ?? []) as SettlementRow[];
  const lines = await linesForSettlements(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...toListItem(row, now),
    cancelledAt: row.cancelled_at,
    lines: lines.get(row.id) ?? [],
  }));
}

export async function createStoreSettlement(storeId: string, idempotencyKey: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("create_store_settlement", {
    p_store_id: storeId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    throwSettlementDbError(error);
  }
  return commandFromPayload(data);
}

export async function markSettlementPaid(
  settlementId: string,
  reference: string | null,
  method: SettlementMethod | null,
) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("mark_settlement_paid", {
    p_settlement_id: settlementId,
    p_reference: reference,
    p_method: method,
  });
  if (error) {
    throwSettlementDbError(error);
  }
  return commandFromPayload(data);
}

export async function cancelSettlement(settlementId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("cancel_settlement", {
    p_settlement_id: settlementId,
  });
  if (error) {
    throwSettlementDbError(error);
  }
  return commandFromPayload(data);
}

export async function getAdminFinanceOverview(now = Date.now()) {
  const supabase = getSupabaseServiceClient();
  const [stores, eventCount, orderCount, giftCount] = await Promise.all([
    countStoresByStatus(),
    countEvents(),
    countOrders(),
    countGifts(),
  ]);

  let settlementsReady = true;
  let paidOrders: {
    total_amount: number | string | null;
    fee_amount: number | string | null;
  }[] = [];
  let vouchers: { amount: number | string; status: string }[] = [];
  let redemptions: {
    amount: number | string;
    commission_percent_snapshot: number | string | null;
    settlement_status: string;
  }[] = [];
  let settlementRows: {
    id: string;
    store_name: string;
    status: string;
    due_at: string;
    gross_amount: number | string;
    commission_amount: number | string;
    payable_amount: number | string;
  }[] = [];

  try {
    paidOrders = await fetchPages((from, to) =>
      supabase
        .from("orders")
        .select("total_amount, fee_amount")
        .eq("payment_status", "paid")
        .order("id", { ascending: true })
        .range(from, to),
    );
    vouchers = await fetchPages((from, to) =>
      supabase
        .from("vouchers")
        .select("amount, status")
        .order("id", { ascending: true })
        .range(from, to),
    );
    redemptions = await fetchPages((from, to) =>
      supabase
        .from("redemptions")
        .select("amount, commission_percent_snapshot, settlement_status")
        .order("id", { ascending: true })
        .range(from, to),
    );
    settlementRows = await fetchPages((from, to) =>
      supabase
        .from("settlements")
        .select("id, store_name, status, due_at, gross_amount, commission_amount, payable_amount")
        .order("id", { ascending: true })
        .range(from, to),
    );
  } catch (error) {
    if (!(error instanceof SettlementSchemaMissingError)) {
      throw error;
    }
    settlementsReady = false;
    settlementRows = [];
  }

  const built = buildFinanceOverview({
    eventCount,
    giftCount,
    activeStores: stores.active,
    inactiveStores: stores.inactive,
    orderCount,
    paidOrders: paidOrders.map((row) => ({
      contribution: money(row.total_amount),
      fee: money(row.fee_amount),
    })),
    vouchers: vouchers.map((row) => ({
      amount: money(row.amount),
      status: row.status,
    })),
    redemptions: redemptions.map((row) => ({
      amount: money(row.amount),
      commissionPercent:
        row.commission_percent_snapshot == null || row.commission_percent_snapshot === ""
          ? null
          : Number(row.commission_percent_snapshot),
      settlementStatus: row.settlement_status,
    })),
    settlements: settlementsReady
      ? settlementRows.map((row) => ({
          id: row.id,
          storeName: row.store_name || "בית עסק",
          status: row.status,
          dueAt: row.due_at,
          grossAmount: money(row.gross_amount),
          commissionAmount: money(row.commission_amount),
          payableAmount: money(row.payable_amount),
        }))
      : [],
    now,
  });

  return {
    settlementsReady,
    overview: built.overview,
    overdue: built.overdue,
  };
}
