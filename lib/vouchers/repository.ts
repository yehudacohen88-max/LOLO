import "server-only";
import { roundMoney } from "@/lib/money";
import {
  generateStoreAccessCode,
  hashStoreAccessCode,
  storeAccessCodeMatches,
} from "@/lib/store/access-code";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { availableToIssue, committedVoucherAmount } from "@/lib/vouchers/ledger";
import {
  generateVoucherCode,
  generateVoucherSecret,
  parseVoucherLookup,
} from "@/lib/vouchers/code";
import { isUuid, safeImageUrl } from "@/lib/vouchers/input";
import {
  isMissingVoucherSchema,
  voucherErrorCode,
  voucherErrorMessage,
  voucherErrorStatus,
  VoucherActionError,
  VoucherSchemaMissingError,
} from "@/lib/vouchers/messages";
import { voucherQrSvg } from "@/lib/vouchers/qr";
import {
  asVoucherStatus,
  effectiveVoucherStatus,
  voucherCanRedeem,
} from "@/lib/vouchers/status";
import { resolveVoucherTerms, termsMatch, type VoucherTerms } from "@/lib/vouchers/terms";
import type {
  AdminRedemption,
  AdminVoucherDetail,
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
    validityDays: row.validity_days ?? 365,
    allowPartialRedemption: row.allow_partial_redemption === true,
    allowCustomerTopup: row.allow_customer_topup === true,
    redemptionMethod: row.redemption_method?.trim() || "הצגת השובר בחנות",
    validityIsDefault: row.validity_is_default === true,
    partialIsDefault: row.partial_is_default === true,
    topupIsDefault: row.topup_is_default === true,
    methodIsDefault: row.method_is_default === true,
  };
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
  };
}

async function loadRedemptions(voucherId: string) {
  if (!isUuid(voucherId)) {
    return [];
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("redemptions")
    .select(
      "id, voucher_id, store_id, amount, redeemed_at, channel, reference, commission_percent_snapshot, payment_terms_days_snapshot, settlement_status",
    )
    .eq("voucher_id", voucherId)
    .order("redeemed_at", { ascending: true });
  if (error) {
    throwVoucherDbError(error);
  }
  return (data ?? []) as RedemptionRow[];
}

async function loadVoucherBy(column: "id" | "view_token" | "code_key", value: string) {
  if (column === "id" && !isUuid(value)) {
    return null;
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select(VOUCHER_DETAIL_COLUMNS)
    .eq(column, value)
    .maybeSingle();
  if (error) {
    throwVoucherDbError(error);
  }
  return (data as VoucherRow | null) ?? null;
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
      p_expected_amount: input.expectedAmount,
    });

    if (!error && data && typeof data === "object" && "id" in data && data.id) {
      const payload = data as { id: string; amount?: number | string; idempotent?: boolean };
      return {
        id: String(payload.id),
        amount: money(payload.amount),
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
  return cardFromRow(row, redemptions, origin, Date.now());
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
  return cardFromRow(row, redemptions, origin, Date.now());
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
  return {
    code: row.code,
    giftTitle: row.gift_title || "מתנה",
    eventTitle: row.event_title || "",
    storeName: row.store_name,
    amount: money(row.amount),
    remainingAmount: money(row.remaining_amount),
    status,
    expiresAt: row.expires_at,
    terms: termsFromRow(row),
    canRedeem: voucherCanRedeem(status),
    blockedReason: blockedReason(status),
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
  const status = effectiveVoucherStatus(
    asVoucherStatus(String(payload.status ?? "")),
    Date.now() + 60_000,
  );
  return {
    voucherId: String(payload.voucherId),
    amount: money(payload.amount),
    remainingAmount: money(payload.remainingAmount),
    status,
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
  const card = await cardFromRow(row, redemptions, origin, now);
  const status = card.status;
  return {
    card,
    eventId: row.event_id,
    storeId: row.store_id,
    canRedeem: voucherCanRedeem(status),
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

export async function listActiveVoucherStores(): Promise<VoucherStoreOption[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .select(
      "id, name, active, logo_url, voucher_validity_days, allow_partial_redemption, allow_customer_topup, voucher_redemption_method",
    )
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) {
    throwVoucherDbError(error);
  }
  return ((data ?? []) as StoreOptionRow[])
    .filter((store) => store.active === true)
    .map((store) => ({
      id: store.id,
      name: store.name,
      logoUrl: safeImageUrl(store.logo_url),
      terms: resolveVoucherTerms({
        voucherValidityDays: store.voucher_validity_days,
        allowPartialRedemption: store.allow_partial_redemption,
        allowCustomerTopup: store.allow_customer_topup,
        voucherRedemptionMethod: store.voucher_redemption_method,
      }),
    }));
}

export async function loadEventVoucherRows(eventId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select("id, gift_id, amount, remaining_amount, status, expires_at, store_name, issued_at")
    .eq("event_id", eventId)
    .order("issued_at", { ascending: false });
  if (error) {
    throwVoucherDbError(error);
  }
  return (data ?? []) as Array<{
    id: string;
    gift_id: string;
    amount: number | string;
    remaining_amount: number | string;
    status: string;
    expires_at: string;
    store_name: string;
    issued_at: string;
  }>;
}

export function hostVouchersByGift(
  rows: Awaited<ReturnType<typeof loadEventVoucherRows>>,
  now = Date.now(),
) {
  const grouped = new Map<
    string,
    { committed: Array<{ amount: number; status: string }>; view: HostGiftVoucher[] }
  >();

  for (const row of rows) {
    const bucket = grouped.get(row.gift_id) ?? { committed: [], view: [] };
    bucket.committed.push({ amount: money(row.amount), status: row.status });
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
  bucket?: { committed: Array<{ amount: number; status: string }>; view: HostGiftVoucher[] },
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
  return store;
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
