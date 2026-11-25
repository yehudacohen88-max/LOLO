import "server-only";
import { roundMoney } from "@/lib/money";
import {
  generateStoreAccessCode,
  hashStoreAccessCode,
  storeAccessCodeMatches,
} from "@/lib/store/access-code";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  allocateVoucherPools,
  planFundedRedeem,
  planFundedVoucherIssue,
  sumPaidPools,
  voucherShowsAsDemo,
  type VoucherPoolSlice,
} from "@/lib/vouchers/demo-funding";
import { buildVoucherBalance } from "@/lib/vouchers/balance";
import { availableToIssue, committedVoucherAmount } from "@/lib/vouchers/ledger";
import {
  generateVoucherCode,
  generateVoucherSecret,
  parseVoucherLookup,
} from "@/lib/vouchers/code";
import { isUuid, safeImageUrl } from "@/lib/vouchers/input";
import {
  isMissingVoucherSchema,
  isMissingVoucherTermColumns,
  voucherErrorCode,
  voucherErrorMessage,
  voucherErrorStatus,
  VOUCHER_TERMS_NOT_CONFIGURED,
  VOUCHER_TERMS_NOT_ENABLED,
  VoucherActionError,
  VoucherSchemaMissingError,
} from "@/lib/vouchers/messages";
import { voucherQrSvg } from "@/lib/vouchers/qr";
import {
  asVoucherStatus,
  effectiveVoucherStatus,
  voucherCanRedeem,
} from "@/lib/vouchers/status";
import {
  resolveVoucherTerms,
  termsMatch,
  validityDaysFromSnapshot,
  type PlatformVoucherDefaults,
  type VoucherTerms,
} from "@/lib/vouchers/terms";
import type {
  AdminRedemption,
  AdminVoucherDetail,
  EventVoucherBalance,
  HostGiftVoucher,
  StoreAccessStatus,
  StoreVoucherLookup,
  VoucherCardModel,
  VoucherListItem,
  VoucherRedemptionView,
  VoucherStoreOption,
} from "@/lib/vouchers/types";

const VOUCHER_LIST_COLUMNS =
  "id, event_id, gift_id, store_id, code, amount, remaining_amount, status, issued_at, expires_at, event_title, gift_title, store_name";

const VOUCHER_DETAIL_COLUMNS = `${VOUCHER_LIST_COLUMNS}, qr_secret, view_token, store_logo_url, validity_days, allow_partial_redemption, allow_customer_topup, redemption_method, validity_is_default, partial_is_default, topup_is_default, method_is_default`;

type VoucherRow = {
  id: string;
  event_id: string;
  gift_id: string;
  store_id: string;
  code: string;
  qr_secret?: string;
  view_token?: string;
  amount: number | string;
  remaining_amount: number | string;
  status: string;
  issued_at: string;
  expires_at: string;
  event_title: string;
  gift_title: string;
  store_name: string;
  store_logo_url?: string | null;
  validity_days?: number;
  allow_partial_redemption?: boolean;
  allow_customer_topup?: boolean;
  redemption_method?: string;
  validity_is_default?: boolean;
  partial_is_default?: boolean;
  topup_is_default?: boolean;
  method_is_default?: boolean;
  demo_only?: boolean | null;
};

type RedemptionRow = {
  id: string;
  voucher_id: string;
  store_id: string;
  amount: number | string;
  redeemed_at: string;
  channel: string;
  reference: string | null;
  commission_percent_snapshot: number | string | null;
  payment_terms_days_snapshot: number | null;
  settlement_status: string;
};

type StoreOptionRow = {
  id: string;
  name: string;
  active: boolean;
  logo_url: string | null;
  voucher_validity_days: number | null;
  allow_partial_redemption: boolean | null;
  allow_customer_topup: boolean | null;
  voucher_redemption_method: string | null;
};

const schemaLogged = new Set<string>();

function money(value: number | string | null | undefined) {
  return roundMoney(Number(value) || 0);
}

function missingColumn(
  error: { code?: string; message?: string } | null,
  column: string,
) {
  if (!error) {
    return false;
  }
  const message = (error.message ?? "").toLowerCase();
  return (
    (error.code === "42703" || error.code === "PGRST204") &&
    message.includes(column.toLowerCase())
  );
}

function asDemoFlag(value: boolean | null | undefined): boolean | null {
  if (value === true) {
    return true;
  }
  if (value === false) {
    return false;
  }
  return null;
}

async function demoGuardReady() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("voucher_demo_guard_version");
  return !error && Number(data) === 1;
}

async function loadGiftFunding(eventId: string, giftId: string) {
  const supabase = getSupabaseServiceClient();
  const orders = await supabase
    .from("orders")
    .select("id, payment_status, payment_provider, payment_reference")
    .eq("event_id", eventId);
  if (orders.error) {
    if (
      missingColumn(orders.error, "payment_provider") ||
      missingColumn(orders.error, "payment_reference")
    ) {
      return { realPaid: 0, simulatedPaid: 0, known: false };
    }
    throwVoucherDbError(orders.error);
  }
  const orderRows = (orders.data ?? []) as Array<{
    id: string;
    payment_status: string;
    payment_provider: string | null;
    payment_reference: string | null;
  }>;
  if (orderRows.length === 0) {
    return { realPaid: 0, simulatedPaid: 0, known: true };
  }
  const items = await supabase
    .from("order_items")
    .select("order_id, amount")
    .eq("gift_id", giftId)
    .in(
      "order_id",
      orderRows.map((order) => order.id),
    );
  if (items.error) {
    throwVoucherDbError(items.error);
  }
  const byId = new Map(orderRows.map((order) => [order.id, order]));
  const sums = sumPaidPools(
    ((items.data ?? []) as Array<{ order_id: string; amount: number | string }>).map((item) => {
      const order = byId.get(String(item.order_id));
      return {
        amount: money(item.amount),
        paymentStatus: order?.payment_status ?? "",
        paymentProvider: order?.payment_provider ?? null,
        paymentReference: order?.payment_reference ?? null,
      };
    }),
  );
  return { ...sums, known: true };
}

function poolSlices(
  rows: Array<{ gift_id: string; amount: number | string; status: string; demo_only?: boolean | null }>,
  giftId: string,
): VoucherPoolSlice[] {
  return rows
    .filter((row) => row.gift_id === giftId)
    .map((row) => ({
      amount: money(row.amount),
      status: row.status,
      demoOnly: asDemoFlag(row.demo_only),
    }));
}

async function voucherMoney(row: VoucherRow) {
  const funding = await loadGiftFunding(row.event_id, row.gift_id);
  const vouchers = await loadEventVoucherRows(row.event_id);
  const pools = allocateVoucherPools({
    realPaid: funding.realPaid,
    simulatedPaid: funding.simulatedPaid,
    vouchers: poolSlices(vouchers, row.gift_id),
  });
  const input = {
    demoOnly: asDemoFlag(row.demo_only),
    voucherAmount: money(row.amount),
    realPaid: funding.realPaid,
    simulatedPaid: funding.simulatedPaid,
    monetaryCommitted: pools.monetaryCommitted,
    fundingKnown: funding.known,
  };
  return {
    demo: voucherShowsAsDemo(input),
    redeemBlocked: !planFundedRedeem(input).ok,
  };
}

function nullableNumber(value: number | string | null | undefined) {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function throwVoucherDbError(error: { message: string; code?: string }): never {
  const key = `${error.code ?? ""}:${error.message}`;
  if (!schemaLogged.has(key)) {
    schemaLogged.add(key);
    console.error("[LOLO] voucher", { code: error.code, message: error.message });
  }
  if (isMissingVoucherSchema(error)) {
    console.error(
      "[LOLO] Voucher schema is missing. Run supabase/vouchers.sql after supabase/demo-checkout.sql.",
    );
    throw new VoucherSchemaMissingError();
  }
  const code = voucherErrorCode(error.message);
  if (code) {
    throw new VoucherActionError(voucherErrorMessage(code), voucherErrorStatus(code));
  }
  throw new VoucherActionError("לא הצלחנו להשלים את הפעולה. נסו שוב.");
}

function termsFromRow(row: VoucherRow): VoucherTerms {
  return {
    validityDays: validityDaysFromSnapshot({
      validityDays: row.validity_days,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
    }),
    allowPartialRedemption: row.allow_partial_redemption === true,
    allowCustomerTopup: row.allow_customer_topup === true,
    redemptionMethod: row.redemption_method?.trim() || "",
    validityIsDefault: row.validity_is_default === true,
    partialIsDefault: row.partial_is_default === true,
    topupIsDefault: row.topup_is_default === true,
    methodIsDefault: row.method_is_default === true,
  };
}

function balanceFrom(row: VoucherRow, redemptions: RedemptionRow[], now = Date.now()) {
  return buildVoucherBalance({
    voucherId: row.id,
    amount: money(row.amount),
    remainingAmount: money(row.remaining_amount),
    status: row.status,
    expiresAt: row.expires_at,
    now,
    redemptions: redemptions.map(redemptionView),
  });
}

function listItem(row: VoucherRow, now: number): VoucherListItem {
  return {
    id: row.id,
    code: row.code,
    storeId: row.store_id,
    storeName: row.store_name,
    giftTitle: row.gift_title,
    eventTitle: row.event_title,
    amount: money(row.amount),
    remainingAmount: money(row.remaining_amount),
    status: effectiveVoucherStatus(asVoucherStatus(row.status), row.expires_at, now),
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
  };
}

function redemptionView(row: RedemptionRow): VoucherRedemptionView {
  return {
    id: row.id,
    amount: money(row.amount),
    redeemedAt: row.redeemed_at,
    channel: row.channel,
    reference: row.reference,
  };
}

function blockedReason(status: ReturnType<typeof effectiveVoucherStatus>) {
  if (status === "EXPIRED") {
    return voucherErrorMessage("voucher_expired");
  }
  if (!voucherCanRedeem(status)) {
    return voucherErrorMessage("voucher_closed");
  }
  return null;
}

async function cardFromRow(
  row: VoucherRow,
  redemptions: RedemptionRow[],
  origin: string,
  now: number,
  demoOnly: boolean,
): Promise<VoucherCardModel> {
  const token = row.view_token ?? "";
  const secret = row.qr_secret ?? "";
  const sharePath = `/v/${encodeURIComponent(token)}`;
  return {
    id: row.id,
    storeName: row.store_name || "בית עסק",
    storeLogoUrl: safeImageUrl(row.store_logo_url),
    giftTitle: row.gift_title || "מתנה",
    eventTitle: row.event_title || "",
    amount: money(row.amount),
    remainingAmount: money(row.remaining_amount),
    code: row.code,
    qrSvg: secret ? await voucherQrSvg(row.code, secret) : "",
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    status: effectiveVoucherStatus(asVoucherStatus(row.status), row.expires_at, now),
    terms: termsFromRow(row),
    redemptions: redemptions.map(redemptionView),
    shareUrl: origin ? `${origin}${sharePath}` : sharePath,
    demoOnly,
  };
}

const REDEMPTION_COLUMNS =
  "id, voucher_id, store_id, amount, redeemed_at, channel, reference, commission_percent_snapshot, payment_terms_days_snapshot, settlement_status";

async function loadRedemptionsFor(voucherIds: string[]) {
  const ids = voucherIds.filter((id) => isUuid(id));
  if (ids.length === 0) {
    return [];
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("redemptions")
    .select(REDEMPTION_COLUMNS)
    .in("voucher_id", ids)
    .order("redeemed_at", { ascending: true });
  if (error) {
    throwVoucherDbError(error);
  }
  return (data ?? []) as RedemptionRow[];
}

async function loadRedemptions(voucherId: string) {
  return loadRedemptionsFor([voucherId]);
}

async function loadVoucherBy(column: "id" | "view_token" | "code_key", value: string) {
  if (column === "id" && !isUuid(value)) {
    return null;
  }
  const supabase = getSupabaseServiceClient();
  const flagged = await supabase
    .from("vouchers")
    .select(`${VOUCHER_DETAIL_COLUMNS}, demo_only`)
    .eq(column, value)
    .maybeSingle();
  if (flagged.error && missingColumn(flagged.error, "demo_only")) {
    const plain = await supabase
      .from("vouchers")
      .select(VOUCHER_DETAIL_COLUMNS)
      .eq(column, value)
      .maybeSingle();
    if (plain.error) {
      throwVoucherDbError(plain.error);
    }
    return plain.data ? ({ ...plain.data, demo_only: null } as VoucherRow) : null;
  }
  if (flagged.error) {
    throwVoucherDbError(flagged.error);
  }
  return (flagged.data as VoucherRow | null) ?? null;
}

export async function issueGiftVoucher(input: {
  eventId: string;
  giftId: string;
  storeId: string;
  expectedAmount: number;
  idempotencyKey: string;
  terms: VoucherTerms;
}) {
  const supabase = getSupabaseServiceClient();
  const prior = await supabase
    .from("vouchers")
    .select("id, amount")
    .eq("gift_id", input.giftId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (prior.error) {
    throwVoucherDbError(prior.error);
  }
  if (prior.data?.id) {
    return {
      id: String(prior.data.id),
      amount: money(prior.data.amount),
      idempotent: true,
    };
  }

  const funding = await loadGiftFunding(input.eventId, input.giftId);
  const existing = await loadEventVoucherRows(input.eventId);
  const guardReady = await demoGuardReady();
  const plan = planFundedVoucherIssue({
    realPaid: funding.realPaid,
    simulatedPaid: funding.simulatedPaid,
    vouchers: poolSlices(existing, input.giftId),
    expectedAmount: input.expectedAmount,
    guardReady,
    fundingKnown: funding.known,
  });
  if (!plan.ok) {
    const code = plan.reason === "changed" ? "voucher_amount_changed" : plan.reason === "demo-blocked" ? "voucher_demo_blocked" : "voucher_none_available";
    throw new VoucherActionError(voucherErrorMessage(code), voucherErrorStatus(code));
  }

  let lastError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.rpc("issue_gift_voucher", {
      p_event_id: input.eventId,
      p_gift_id: input.giftId,
      p_store_id: input.storeId,
      p_code: generateVoucherCode(),
      p_qr_secret: generateVoucherSecret(),
      p_view_token: generateVoucherSecret(),
      p_idempotency_key: input.idempotencyKey,
      p_validity_days: input.terms.validityDays,
      p_allow_partial: input.terms.allowPartialRedemption,
      p_allow_topup: input.terms.allowCustomerTopup,
      p_redemption_method: input.terms.redemptionMethod,
      p_validity_is_default: input.terms.validityIsDefault,
      p_partial_is_default: input.terms.partialIsDefault,
      p_topup_is_default: input.terms.topupIsDefault,
      p_method_is_default: input.terms.methodIsDefault,
      p_expected_amount: plan.amount,
    });

    if (!error && data && typeof data === "object" && "id" in data && data.id) {
      const payload = data as { id: string; amount?: number | string; idempotent?: boolean };
      const issuedId = String(payload.id);
      const issuedAmount = money(payload.amount);
      if (payload.idempotent !== true) {
        const created = await loadVoucherBy("id", issuedId);
        const issuedDemo = created ? asDemoFlag(created.demo_only) === true : false;
        const overReal = plan.kind === "monetary" && issuedAmount > plan.amount;
        const demoNotMarked = plan.kind === "demo" && !issuedDemo;
        if (overReal || demoNotMarked) {
          try {
            await cancelVoucher(issuedId);
          } catch (cancelError) {
            console.error("[LOLO] demo voucher fail-closed cancel", {
              message: cancelError instanceof Error ? cancelError.message : "unknown",
            });
          }
          throw new VoucherActionError(
            voucherErrorMessage("voucher_demo_blocked"),
            voucherErrorStatus("voucher_demo_blocked"),
          );
        }
      }
      return {
        id: issuedId,
        amount: issuedAmount,
        idempotent: payload.idempotent === true,
      };
    }

    if (error && voucherErrorCode(error.message) === "voucher_code_collision") {
      lastError = error;
      continue;
    }
    if (error) {
      throwVoucherDbError(error);
    }
    lastError = { message: "voucher_code_collision" };
  }

  throwVoucherDbError(lastError ?? { message: "voucher_code_collision" });
}

export async function getHostVoucherCard(eventId: string, voucherId: string, origin: string) {
  const row = await loadVoucherBy("id", voucherId);
  if (!row || row.event_id !== eventId) {
    return null;
  }
  const redemptions = await loadRedemptions(row.id);
  const moneyView = await voucherMoney(row);
  return cardFromRow(row, redemptions, origin, Date.now(), moneyView.demo);
}

export async function getPublicVoucherCard(token: string, origin: string) {
  if (!token || token.length < 32 || token.length > 80) {
    return null;
  }
  const row = await loadVoucherBy("view_token", token);
  if (!row) {
    return null;
  }
  const redemptions = await loadRedemptions(row.id);
  const moneyView = await voucherMoney(row);
  return cardFromRow(row, redemptions, origin, Date.now(), moneyView.demo);
}

export async function lookupStoreVoucher(
  storeId: string,
  rawCode: string,
): Promise<StoreVoucherLookup> {
  const parsed = parseVoucherLookup(rawCode);
  const codeKey = parsed.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const row = codeKey ? await loadVoucherBy("code_key", codeKey) : null;
  if (!row || row.store_id !== storeId || (parsed.qrSecret && parsed.qrSecret !== row.qr_secret)) {
    throw new VoucherActionError(voucherErrorMessage("voucher_not_found"), 404);
  }

  const now = Date.now();
  const status = effectiveVoucherStatus(asVoucherStatus(row.status), row.expires_at, now);
  const moneyView = await voucherMoney(row);
  const redemptions = await loadRedemptions(row.id);
  const balance = balanceFrom(row, redemptions, now);
  return {
    code: row.code,
    giftTitle: row.gift_title || "מתנה",
    eventTitle: row.event_title || "",
    storeName: row.store_name,
    amount: balance.amount,
    remainingAmount: balance.remainingAmount,
    status: balance.status,
    expiresAt: row.expires_at,
    terms: termsFromRow(row),
    canRedeem: voucherCanRedeem(status) && !moneyView.redeemBlocked,
    blockedReason: moneyView.redeemBlocked
      ? voucherErrorMessage("voucher_demo_blocked")
      : blockedReason(status),
    balance,
  };
}

export async function redeemVoucher(input: {
  storeId: string;
  channel: "store" | "admin";
  redeemedBy: string;
  amount: number | null;
  reference: string | null;
  voucherId?: string;
  rawCode?: string;
}) {
  const parsed = input.rawCode ? parseVoucherLookup(input.rawCode) : null;
  const codeKey = parsed ? parsed.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase() : "";
  const row = input.voucherId
    ? await loadVoucherBy("id", input.voucherId)
    : codeKey
      ? await loadVoucherBy("code_key", codeKey)
      : null;
  if (!row || row.store_id !== input.storeId || (parsed?.qrSecret && parsed.qrSecret !== row.qr_secret)) {
    throw new VoucherActionError(voucherErrorMessage("voucher_not_found"), 404);
  }
  const moneyView = await voucherMoney(row);
  if (moneyView.redeemBlocked) {
    throw new VoucherActionError(
      voucherErrorMessage("voucher_demo_blocked"),
      voucherErrorStatus("voucher_demo_blocked"),
    );
  }
  const now = Date.now();
  const openStatus = effectiveVoucherStatus(asVoucherStatus(row.status), row.expires_at, now);
  if (openStatus === "EXPIRED") {
    throw new VoucherActionError(
      voucherErrorMessage("voucher_expired"),
      voucherErrorStatus("voucher_expired"),
    );
  }
  if (!voucherCanRedeem(openStatus)) {
    throw new VoucherActionError(
      voucherErrorMessage("voucher_closed"),
      voucherErrorStatus("voucher_closed"),
    );
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("redeem_voucher", {
    p_store_id: input.storeId,
    p_channel: input.channel,
    p_redeemed_by: input.redeemedBy,
    p_amount: input.amount,
    p_reference: input.reference,
    p_voucher_id: input.voucherId ?? null,
    p_code: parsed?.code ?? null,
    p_qr_secret: parsed?.qrSecret ?? null,
  });
  if (error) {
    throwVoucherDbError(error);
  }
  const payload = data as {
    amount?: number | string;
    remainingAmount?: number | string;
    status?: string;
    voucherId?: string;
  } | null;
  if (!payload?.voucherId) {
    throw new VoucherActionError("המימוש נכשל.");
  }
  const voucherId = String(payload.voucherId);
  const fresh = await loadVoucherBy("id", voucherId);
  const redemptions = await loadRedemptions(voucherId);
  const balance = fresh
    ? balanceFrom(fresh, redemptions)
    : buildVoucherBalance({
        voucherId,
        amount: money(row.amount),
        remainingAmount: money(payload.remainingAmount),
        status: String(payload.status ?? row.status),
        expiresAt: row.expires_at,
        redemptions: redemptions.map(redemptionView),
      });
  return {
    voucherId,
    amount: money(payload.amount),
    remainingAmount: balance.remainingAmount,
    status: balance.status,
    balance,
  };
}

export async function cancelVoucher(voucherId: string) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.rpc("cancel_voucher", { p_voucher_id: voucherId });
  if (error) {
    throwVoucherDbError(error);
  }
}

export async function listAdminVouchers(filters: { status?: string; storeId?: string }) {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from("vouchers")
    .select(VOUCHER_LIST_COLUMNS)
    .order("issued_at", { ascending: false })
    .limit(300);
  if (filters.storeId) {
    query = query.eq("store_id", filters.storeId);
  }
  const { data, error } = await query;
  if (error) {
    throwVoucherDbError(error);
  }
  const now = Date.now();
  return ((data ?? []) as VoucherRow[])
    .map((row) => listItem(row, now))
    .filter((row) => !filters.status || row.status === filters.status)
    .slice(0, 100);
}

export async function getAdminVoucherDetail(
  voucherId: string,
  origin: string,
): Promise<AdminVoucherDetail | null> {
  const row = await loadVoucherBy("id", voucherId);
  if (!row) {
    return null;
  }
  const redemptions = await loadRedemptions(row.id);
  const now = Date.now();
  const moneyView = await voucherMoney(row);
  const card = await cardFromRow(row, redemptions, origin, now, moneyView.demo);
  const status = card.status;
  return {
    card,
    eventId: row.event_id,
    storeId: row.store_id,
    canRedeem: voucherCanRedeem(status) && !moneyView.redeemBlocked,
    canCancel:
      redemptions.length === 0 &&
      (status === "ISSUED" || status === "EXPIRED" || status === "PARTIALLY_REDEEMED") &&
      money(row.remaining_amount) === money(row.amount),
  };
}

export async function listVoucherAdminRedemptions(voucherId: string) {
  const [rows, voucher] = await Promise.all([
    loadRedemptions(voucherId),
    loadVoucherBy("id", voucherId),
  ]);
  return rows.map((row) => toAdminRedemption(row, voucher));
}

export async function listAdminRedemptions(storeId?: string) {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from("redemptions")
    .select(
      "id, voucher_id, store_id, amount, redeemed_at, channel, reference, commission_percent_snapshot, payment_terms_days_snapshot, settlement_status",
    )
    .order("redeemed_at", { ascending: false })
    .limit(200);
  if (storeId) {
    query = query.eq("store_id", storeId);
  }
  const { data, error } = await query;
  if (error) {
    throwVoucherDbError(error);
  }
  const rows = (data ?? []) as RedemptionRow[];
  const voucherIds = [...new Set(rows.map((row) => row.voucher_id))];
  const vouchers = new Map<string, VoucherRow>();
  if (voucherIds.length > 0) {
    const loaded = await supabase
      .from("vouchers")
      .select("id, code, gift_title, store_name, store_id")
      .in("id", voucherIds);
    if (loaded.error) {
      throwVoucherDbError(loaded.error);
    }
    for (const row of (loaded.data ?? []) as VoucherRow[]) {
      vouchers.set(row.id, row);
    }
  }

  return rows.map((row) => toAdminRedemption(row, vouchers.get(row.voucher_id) ?? null));
}

function toAdminRedemption(row: RedemptionRow, voucher: VoucherRow | null): AdminRedemption {
  return {
    id: row.id,
    voucherId: row.voucher_id,
    voucherCode: voucher?.code ?? "",
    storeId: row.store_id,
    storeName: voucher?.store_name ?? "",
    giftTitle: voucher?.gift_title ?? "",
    amount: money(row.amount),
    redeemedAt: row.redeemed_at,
    channel: row.channel,
    reference: row.reference,
    commissionPercent: nullableNumber(row.commission_percent_snapshot),
    paymentTermsDays: row.payment_terms_days_snapshot,
    settlementStatus: row.settlement_status || "UNSETTLED",
  };
}

const PLATFORM_VOUCHER_DEFAULT_COLUMNS =
  "voucher_default_validity_days, voucher_default_allow_partial, voucher_default_allow_topup, voucher_default_redemption_method";

function optionalBoolean(value: unknown) {
  return value === true || value === false ? value : null;
}

function optionalMethod(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const method = value.trim();
  if (!method || method.length > 80) {
    return null;
  }
  return method;
}

function optionalValidity(value: unknown) {
  if (value == null || value === "") {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 3650 ? number : null;
}

export async function readPlatformVoucherDefaults(): Promise<
  { ready: true; defaults: PlatformVoucherDefaults } | { ready: false }
> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select(PLATFORM_VOUCHER_DEFAULT_COLUMNS)
    .eq("id", "default")
    .maybeSingle();
  if (error) {
    if (isMissingVoucherTermColumns(error)) {
      return { ready: false };
    }
    throwVoucherDbError(error);
  }
  const row = (data ?? {}) as {
    voucher_default_validity_days?: number | string | null;
    voucher_default_allow_partial?: boolean | null;
    voucher_default_allow_topup?: boolean | null;
    voucher_default_redemption_method?: string | null;
  };
  return {
    ready: true,
    defaults: {
      validityDays: optionalValidity(row.voucher_default_validity_days),
      allowPartialRedemption: optionalBoolean(row.voucher_default_allow_partial),
      allowCustomerTopup: optionalBoolean(row.voucher_default_allow_topup),
      redemptionMethod: optionalMethod(row.voucher_default_redemption_method),
    },
  };
}

function storeOption(
  store: StoreOptionRow,
  platform: { ready: true; defaults: PlatformVoucherDefaults } | { ready: false },
): VoucherStoreOption {
  const base = {
    id: store.id,
    name: store.name,
    logoUrl: safeImageUrl(store.logo_url),
  };
  if (!platform.ready) {
    return { ...base, terms: null, termsMessage: VOUCHER_TERMS_NOT_ENABLED };
  }
  const resolved = resolveVoucherTerms(
    {
      voucherValidityDays: store.voucher_validity_days,
      allowPartialRedemption: store.allow_partial_redemption,
      allowCustomerTopup: store.allow_customer_topup,
      voucherRedemptionMethod: store.voucher_redemption_method,
    },
    platform.defaults,
  );
  if (!resolved.ok) {
    return { ...base, terms: null, termsMessage: VOUCHER_TERMS_NOT_CONFIGURED };
  }
  return { ...base, terms: resolved.terms, termsMessage: null };
}

export async function listActiveVoucherStores(): Promise<VoucherStoreOption[]> {
  const supabase = getSupabaseServiceClient();
  const [platform, stores] = await Promise.all([
    readPlatformVoucherDefaults(),
    supabase
      .from("stores")
      .select(
        "id, name, active, logo_url, voucher_validity_days, allow_partial_redemption, allow_customer_topup, voucher_redemption_method",
      )
      .eq("active", true)
      .order("name", { ascending: true }),
  ]);
  if (stores.error) {
    throwVoucherDbError(stores.error);
  }
  return ((stores.data ?? []) as StoreOptionRow[])
    .filter((store) => store.active === true)
    .map((store) => storeOption(store, platform));
}

export async function listEventVoucherBalances(eventId: string): Promise<EventVoucherBalance[]> {
  const supabase = getSupabaseServiceClient();
  const loaded = await supabase
    .from("vouchers")
    .select(
      "id, event_id, gift_id, store_id, code, amount, remaining_amount, status, issued_at, expires_at, event_title, gift_title, store_name",
    )
    .eq("event_id", eventId)
    .order("issued_at", { ascending: false });
  if (loaded.error) {
    throwVoucherDbError(loaded.error);
  }
  const rows = (loaded.data ?? []) as VoucherRow[];
  const redemptions = await loadRedemptionsFor(rows.map((row) => row.id));
  const now = Date.now();
  return rows.map((row) => {
    const balance = balanceFrom(
      row,
      redemptions.filter((redemption) => redemption.voucher_id === row.id),
      now,
    );
    return {
      ...balance,
      giftId: row.gift_id,
      giftTitle: row.gift_title || "מתנה",
      storeName: row.store_name,
    };
  });
}

export async function loadEventVoucherRows(eventId: string) {
  const supabase = getSupabaseServiceClient();
  const columns =
    "id, gift_id, amount, remaining_amount, status, expires_at, store_name, issued_at, demo_only";
  const flagged = await supabase
    .from("vouchers")
    .select(columns)
    .eq("event_id", eventId)
    .order("issued_at", { ascending: false });
  const result =
    flagged.error && missingColumn(flagged.error, "demo_only")
      ? await supabase
          .from("vouchers")
          .select("id, gift_id, amount, remaining_amount, status, expires_at, store_name, issued_at")
          .eq("event_id", eventId)
          .order("issued_at", { ascending: false })
      : flagged;
  if (result.error) {
    throwVoucherDbError(result.error);
  }
  return (result.data ?? []) as Array<{
    id: string;
    gift_id: string;
    amount: number | string;
    remaining_amount: number | string;
    status: string;
    expires_at: string;
    store_name: string;
    issued_at: string;
    demo_only?: boolean | null;
  }>;
}

export function hostVouchersByGift(
  rows: Awaited<ReturnType<typeof loadEventVoucherRows>>,
  now = Date.now(),
) {
  const grouped = new Map<
    string,
    {
      committed: Array<{ amount: number; status: string; demoOnly: boolean | null }>;
      view: HostGiftVoucher[];
    }
  >();

  for (const row of rows) {
    const bucket = grouped.get(row.gift_id) ?? { committed: [], view: [] };
    bucket.committed.push({
      amount: money(row.amount),
      status: row.status,
      demoOnly: asDemoFlag(row.demo_only),
    });
    bucket.view.push({
      id: row.id,
      amount: money(row.amount),
      remainingAmount: money(row.remaining_amount),
      status: effectiveVoucherStatus(asVoucherStatus(row.status), row.expires_at, now),
      expiresAt: row.expires_at,
      storeName: row.store_name,
    });
    grouped.set(row.gift_id, bucket);
  }

  return grouped;
}

export function giftVoucherAmounts(
  paidAmount: number,
  bucket?: {
    committed: Array<{ amount: number; status: string; demoOnly?: boolean | null }>;
    view: HostGiftVoucher[];
  },
) {
  const committed = bucket?.committed ?? [];
  return {
    voucheredAmount: committedVoucherAmount(committed),
    availableAmount: availableToIssue(paidAmount, committed),
    vouchers: bucket?.view ?? [],
  };
}

export async function resolveIssueStore(
  eventId: string,
  giftId: string,
  requestedStoreId: string,
) {
  const supabase = getSupabaseServiceClient();
  const { data: gift, error } = await supabase
    .from("event_gifts")
    .select("id, event_id, store_id")
    .eq("id", giftId)
    .maybeSingle();
  if (error) {
    throwVoucherDbError(error);
  }
  if (!gift || gift.event_id !== eventId) {
    throw new VoucherActionError(voucherErrorMessage("voucher_gift_not_found"), 404);
  }

  let storeId = requestedStoreId;
  if (gift.store_id) {
    const linked = await supabase
      .from("stores")
      .select("id, active")
      .eq("id", gift.store_id)
      .maybeSingle();
    if (linked.error) {
      throwVoucherDbError(linked.error);
    }
    if (linked.data?.active === true) {
      storeId = String(gift.store_id);
    }
  }

  const stores = await listActiveVoucherStores();
  const store = stores.find((item) => item.id === storeId);
  if (!store) {
    throw new VoucherActionError(
      voucherErrorMessage(gift.store_id ? "voucher_store_inactive" : "voucher_store_required"),
      400,
    );
  }
  if (!store.terms) {
    const message = store.termsMessage || VOUCHER_TERMS_NOT_CONFIGURED;
    throw new VoucherActionError(message, message === VOUCHER_TERMS_NOT_ENABLED ? 503 : 409);
  }
  return { ...store, terms: store.terms };
}

export function confirmedTermsDiffer(
  confirmed: {
    validityDays: number;
    allowPartialRedemption: boolean;
    allowCustomerTopup: boolean;
    redemptionMethod: string;
  },
  terms: VoucherTerms,
) {
  return !termsMatch(confirmed, terms);
}

export async function loadHostVoucherContext(eventId: string) {
  try {
    const [rows, stores] = await Promise.all([
      loadEventVoucherRows(eventId),
      listActiveVoucherStores(),
    ]);
    return {
      ready: true as const,
      byGift: hostVouchersByGift(rows),
      stores,
    };
  } catch (error) {
    if (error instanceof VoucherSchemaMissingError) {
      return {
        ready: false as const,
        byGift: hostVouchersByGift([]),
        stores: [] as VoucherStoreOption[],
      };
    }
    throw error;
  }
}

export async function getStoreLabel(storeId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .select("name")
    .eq("id", storeId)
    .maybeSingle();
  if (error) {
    throwVoucherDbError(error);
  }
  return typeof data?.name === "string" ? data.name : "";
}

export async function findStoreForLogin(slug: string, accessCode: string) {
  const supabase = getSupabaseServiceClient();
  const { data: store, error } = await supabase
    .from("stores")
    .select("id, active")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    throwVoucherDbError(error);
  }

  const access = store
    ? await supabase
        .from("store_redemption_access")
        .select("code_hash")
        .eq("store_id", store.id)
        .maybeSingle()
    : { data: null, error: null };
  if (access.error) {
    throwVoucherDbError(access.error);
  }

  const matches = await storeAccessCodeMatches(accessCode, access.data?.code_hash ?? "");
  if (!store || store.active !== true || !access.data?.code_hash || !matches) {
    return null;
  }
  return String(store.id);
}

export async function getStoreAccessStatus(storeId: string): Promise<StoreAccessStatus> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("store_redemption_access")
    .select("updated_at")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) {
    throwVoucherDbError(error);
  }
  return {
    configured: Boolean(data),
    updatedAt: data?.updated_at ?? null,
  };
}

export async function rotateStoreAccessCode(storeId: string) {
  const supabase = getSupabaseServiceClient();
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .maybeSingle();
  if (storeError) {
    throwVoucherDbError(storeError);
  }
  if (!store) {
    throw new VoucherActionError("בית העסק לא נמצא.", 404);
  }

  const code = generateStoreAccessCode();
  const codeHash = await hashStoreAccessCode(code);
  const { error } = await supabase.from("store_redemption_access").upsert(
    {
      store_id: storeId,
      code_hash: codeHash,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "store_id" },
  );
  if (error) {
    throwVoucherDbError(error);
  }
  return code;
}

export function resetVoucherSchemaLogs() {
  schemaLogged.clear();
}
