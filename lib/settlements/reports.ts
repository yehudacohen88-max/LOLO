import "server-only";
import { listAdminStores } from "@/lib/admin/stores";
import { roundMoney } from "@/lib/money";
import { assertSettlementsEnabled } from "@/lib/settlements/availability";
import {
  isMissingOptionalSettlementColumn,
  isMissingSettlementSchema,
  SettlementActionError,
  settlementErrorCode,
  settlementErrorMessage,
  settlementErrorStatus,
  SettlementSchemaMissingError,
} from "@/lib/settlements/messages";
import {
  EMPTY_SETTLEMENT_POLICY,
  type SettlementPolicy,
} from "@/lib/settlements/policy";
import { buildReconciliation, type ReconciliationSettlement } from "@/lib/settlements/reconcile";
import { SETTLEMENT_ROUNDING_RULE } from "@/lib/settlements/rounding";
import { buildStatement, type StatementSource } from "@/lib/settlements/statement";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type DbError = { message: string; code?: string };

function money(value: number | string | null | undefined) {
  return roundMoney(Number(value) || 0);
}

function nullableNumber(value: number | string | null | undefined) {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function raiseDb(error: DbError): never {
  console.error("[LOLO] settlement report", { code: error.code, message: error.message });
  if (isMissingSettlementSchema(error)) {
    const missingDemo = (error.message ?? "").toLowerCase().includes("demo_only");
    throw new SettlementSchemaMissingError(
      missingDemo
        ? "ההתחשבנות עדיין לא הופעלה. קודם מחילים את קובץ שומר ההדגמה, ואז את קובץ ההחרגה."
        : undefined,
    );
  }
  const code = settlementErrorCode(error.message);
  if (code) {
    throw new SettlementActionError(settlementErrorMessage(code), settlementErrorStatus(code));
  }
  throw new SettlementActionError("לא הצלחנו לטעון את הדוח. נסו שוב.");
}

async function fetchPages<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: DbError | null }>,
) {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let page = 0; page < 50; page += 1) {
    const from = page * pageSize;
    const { data, error } = await load(from, from + pageSize - 1);
    if (error) {
      raiseDb(error);
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) {
      return rows;
    }
  }
  return rows;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Dashboard estimate only. Settlement batches never use this fallback:
 * they read platform_settings.money_rounding and refuse when it is empty.
 * While settlements are off, an unset column keeps the existing overview
 * on the one named rule that SQL also implements.
 */
export function settlementRoundingForOverview(policy: SettlementPolicy, enabled: boolean): SettlementPolicy {
  if (policy.rounding || enabled) {
    return policy;
  }
  return { ...policy, rounding: SETTLEMENT_ROUNDING_RULE };
}

export async function readSettlementPolicy(): Promise<SettlementPolicy> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("default_commission_percent, default_payment_terms_days, money_rounding")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    if (
      isMissingOptionalSettlementColumn(error, "default_commission_percent") ||
      isMissingOptionalSettlementColumn(error, "default_payment_terms_days") ||
      isMissingOptionalSettlementColumn(error, "money_rounding")
    ) {
      return EMPTY_SETTLEMENT_POLICY;
    }
    raiseDb(error);
  }

  const row = data as {
    default_commission_percent: number | string | null;
    default_payment_terms_days: number | null;
    money_rounding: string | null;
  } | null;

  return {
    rounding: row?.money_rounding || null,
    fallbackCommissionPercent: nullableNumber(row?.default_commission_percent),
    fallbackPaymentTermsDays:
      row?.default_payment_terms_days == null ? null : Number(row.default_payment_terms_days),
  };
}

export async function saveSettlementPolicy(policy: SettlementPolicy) {
  assertSettlementsEnabled();
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .update({
      default_commission_percent: policy.fallbackCommissionPercent,
      default_payment_terms_days: policy.fallbackPaymentTermsDays,
      money_rounding: policy.rounding,
    })
    .eq("id", "default")
    .select("id")
    .maybeSingle();

  if (error) {
    if (
      isMissingOptionalSettlementColumn(error, "default_commission_percent") ||
      isMissingOptionalSettlementColumn(error, "money_rounding") ||
      isMissingOptionalSettlementColumn(error, "default_payment_terms_days")
    ) {
      throw new SettlementSchemaMissingError();
    }
    raiseDb(error);
  }
  if (!data) {
    throw new SettlementActionError("שמירת הגדרות ההתחשבנות נכשלה.");
  }
}

export async function loadOverviewRedemptions() {
  const supabase = getSupabaseServiceClient();
  const probe = await supabase
    .from("redemptions")
    .select("id, vouchers!inner(demo_only)")
    .limit(1);

  if (probe.error && isMissingOptionalSettlementColumn(probe.error, "demo_only")) {
    const rows = await fetchPages<{
      amount: number | string;
      commission_percent_snapshot: number | string | null;
      settlement_status: string;
    }>((from, to) =>
      supabase
        .from("redemptions")
        .select("amount, commission_percent_snapshot, settlement_status")
        .order("id", { ascending: true })
        .range(from, to),
    );
    return {
      demoColumnReady: false,
      rows: rows.map((row) => ({ ...row, demoOnly: false })),
    };
  }
  if (probe.error) {
    raiseDb(probe.error);
  }

  const rows = await fetchPages<{
    amount: number | string;
    commission_percent_snapshot: number | string | null;
    settlement_status: string;
    vouchers: { demo_only?: boolean | null } | { demo_only?: boolean | null }[] | null;
  }>((from, to) =>
    supabase
      .from("redemptions")
      .select("amount, commission_percent_snapshot, settlement_status, vouchers!inner(demo_only)")
      .order("id", { ascending: true })
      .range(from, to),
  );

  return {
    demoColumnReady: true,
    rows: rows.map((row) => {
      const voucher = one(row.vouchers);
      return {
        amount: row.amount,
        commission_percent_snapshot: row.commission_percent_snapshot,
        settlement_status: row.settlement_status,
        demoOnly: voucher?.demo_only === true,
      };
    }),
  };
}

type UnsettledRow = {
  id: string;
  store_id: string;
  amount: number | string;
  commission_percent_snapshot: number | string | null;
  payment_terms_days_snapshot: number | null;
  settlement_status: string;
  redeemed_at: string;
  vouchers:
    | {
        demo_only?: boolean | null;
        code?: string | null;
        gift_title?: string | null;
        event_title?: string | null;
      }
    | {
        demo_only?: boolean | null;
        code?: string | null;
        gift_title?: string | null;
        event_title?: string | null;
      }[]
    | null;
};

type LineRow = {
  redemption_id: string;
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
  vouchers: { demo_only?: boolean | null } | { demo_only?: boolean | null }[] | null;
  redemptions: { settlement_status: string } | { settlement_status: string }[] | null;
  settlements:
    | {
        id: string;
        store_id: string;
        store_name: string;
        status: string;
        gross_amount: number | string;
        commission_amount: number | string;
        payable_amount: number | string;
        paid_at: string | null;
        payment_reference: string | null;
        payment_method: string | null;
      }
    | {
        id: string;
        store_id: string;
        store_name: string;
        status: string;
        gross_amount: number | string;
        commission_amount: number | string;
        payable_amount: number | string;
        paid_at: string | null;
        payment_reference: string | null;
        payment_method: string | null;
      }[]
    | null;
};

async function loadSources(storeId?: string) {
  const supabase = getSupabaseServiceClient();
  const stores = await listAdminStores();
  const names = new Map(stores.map((store) => [store.id, store.name]));

  const unsettled = await fetchPages<UnsettledRow>((from, to) => {
    let query = supabase
      .from("redemptions")
      .select(
        "id, store_id, amount, commission_percent_snapshot, payment_terms_days_snapshot, settlement_status, redeemed_at, vouchers!inner(demo_only, code, gift_title, event_title)",
      )
      .eq("settlement_status", "UNSETTLED")
      .order("redeemed_at", { ascending: true });
    if (storeId) {
      query = query.eq("store_id", storeId);
    }
    return query.range(from, to);
  });

  const lines = await fetchPages<LineRow>((from, to) => {
    let query = supabase
      .from("settlement_lines")
      .select(
        "redemption_id, gross_amount, commission_percent, commission_specified, commission_amount, payable_amount, payment_terms_days, terms_specified, redeemed_at, due_at, voucher_code, gift_title, event_title, vouchers!inner(demo_only), redemptions!inner(settlement_status), settlements!inner(id, store_id, store_name, status, gross_amount, commission_amount, payable_amount, paid_at, payment_reference, payment_method)",
      )
      .is("released_at", null)
      .order("redeemed_at", { ascending: true });
    if (storeId) {
      query = query.eq("settlements.store_id", storeId);
    }
    return query.range(from, to);
  });

  const sources: StatementSource[] = [];

  for (const row of unsettled) {
    const voucher = one(row.vouchers);
    sources.push({
      id: row.id,
      storeId: row.store_id,
      storeName: names.get(row.store_id) || "בית עסק",
      gross: money(row.amount),
      commissionPercent: nullableNumber(row.commission_percent_snapshot),
      paymentTermsDays: row.payment_terms_days_snapshot,
      redeemedAt: row.redeemed_at,
      voucherCode: voucher?.code ?? "",
      giftTitle: voucher?.gift_title || "מתנה",
      eventTitle: voucher?.event_title ?? "",
      demoOnly: voucher?.demo_only === true,
      settlementId: null,
      settlementStatus: row.settlement_status,
      paidAt: null,
      paymentReference: null,
      paymentMethod: null,
      stored: null,
    });
  }

  const settlementHeaders = new Map<string, ReconciliationSettlement>();
  for (const row of lines) {
    const voucher = one(row.vouchers);
    const redemption = one(row.redemptions);
    const settlement = one(row.settlements);
    if (!settlement) {
      continue;
    }
    const demoOnly = voucher?.demo_only === true;
    sources.push({
      id: row.redemption_id,
      storeId: settlement.store_id,
      storeName: settlement.store_name || names.get(settlement.store_id) || "בית עסק",
      gross: money(row.gross_amount),
      commissionPercent: money(row.commission_percent),
      paymentTermsDays: row.payment_terms_days,
      redeemedAt: row.redeemed_at,
      voucherCode: row.voucher_code,
      giftTitle: row.gift_title || "מתנה",
      eventTitle: row.event_title,
      demoOnly,
      settlementId: settlement.id,
      settlementStatus: redemption?.settlement_status ?? settlement.status,
      paidAt: settlement.paid_at,
      paymentReference: settlement.payment_reference,
      paymentMethod: settlement.payment_method,
      stored: demoOnly
        ? null
        : {
            commissionPercent: money(row.commission_percent),
            commissionSpecified: row.commission_specified === true,
            commissionAmount: money(row.commission_amount),
            payableAmount: money(row.payable_amount),
            paymentTermsDays: row.payment_terms_days,
            termsSpecified: row.terms_specified === true,
            dueAt: row.due_at,
          },
    });

    const header = settlementHeaders.get(settlement.id) ?? {
      id: settlement.id,
      storeId: settlement.store_id,
      storeName: settlement.store_name || "בית עסק",
      status: settlement.status,
      grossAmount: money(settlement.gross_amount),
      commissionAmount: money(settlement.commission_amount),
      payableAmount: money(settlement.payable_amount),
      paymentReference: settlement.payment_reference,
      lineRedemptionIds: [],
    };
    header.lineRedemptionIds.push(row.redemption_id);
    settlementHeaders.set(settlement.id, header);
  }

  return { sources, settlements: [...settlementHeaders.values()] };
}

export async function loadSettlementReport(storeId?: string) {
  assertSettlementsEnabled();
  const policy = await readSettlementPolicy();
  const { sources } = await loadSources(storeId);
  return buildStatement(sources, policy);
}

export async function loadReconciliation() {
  assertSettlementsEnabled();
  const policy = await readSettlementPolicy();
  const { sources, settlements } = await loadSources();
  const statement = buildStatement(sources, policy);
  return {
    statement,
    reconciliation: buildReconciliation(statement.rows, settlements),
  };
}
