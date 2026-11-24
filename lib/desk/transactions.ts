import type { Db } from "@/lib/desk/db";
import { isMissingColumn, isMissingRelation, rowsOf } from "@/lib/desk/db";
import { DEMO_CLASS_UNAVAILABLE } from "@/lib/desk/messages";
import { roundMoney } from "@/lib/money";
import { DEMO_REDEMPTION_LABEL } from "@/lib/settlements/labels";
import { VOUCHER_SCHEMA_MESSAGE } from "@/lib/vouchers/messages";

export type TransactionKind = "all" | "demo" | "standard";

export type StoreTransaction = {
  id: string;
  storeId: string;
  voucherCode: string;
  giftTitle: string;
  eventTitle: string;
  amount: number;
  redeemedAt: string;
  channel: string;
  reference: string;
  settlementStatus: string;
  demoOnly: boolean | null;
  label: string;
};

export type StoreTransactionPage = {
  available: boolean;
  classificationAvailable: boolean;
  message: string;
  rows: StoreTransaction[];
  standardGross: number | null;
  demoGross: number | null;
};

type VoucherJoin = {
  code?: string | null;
  gift_title?: string | null;
  event_title?: string | null;
  demo_only?: boolean | null;
};

type RedemptionRow = {
  id: string;
  store_id: string;
  amount: number | string;
  redeemed_at: string;
  channel: string;
  reference: string | null;
  settlement_status: string | null;
  voucher_id: string;
  vouchers: VoucherJoin | VoucherJoin[] | null;
};

const WITH_DEMO =
  "id, store_id, amount, redeemed_at, channel, reference, settlement_status, voucher_id, vouchers!inner(code, gift_title, event_title, demo_only)";

const WITHOUT_DEMO =
  "id, store_id, amount, redeemed_at, channel, reference, settlement_status, voucher_id, vouchers!inner(code, gift_title, event_title)";

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDay(value: string | null | undefined) {
  if (!value || !DAY.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

export function dayStart(day: string) {
  return `${day}T00:00:00.000Z`;
}

export function nextDayStart(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString();
}

export function readTransactionQuery(url: string) {
  const params = new URL(url).searchParams;
  return {
    from: parseDay(params.get("from")),
    to: parseDay(params.get("to")),
    kind: parseTransactionKind(params.get("kind")),
  };
}

export function parseTransactionKind(value: string | null | undefined): TransactionKind {
  if (value === "demo" || value === "standard") {
    return value;
  }
  return "all";
}

function one(value: VoucherJoin | VoucherJoin[] | null | undefined) {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function empty(message: string, available: boolean): StoreTransactionPage {
  return {
    available,
    classificationAvailable: false,
    message,
    rows: [],
    standardGross: null,
    demoGross: null,
  };
}

async function loadRows(
  db: Db,
  storeId: string,
  columns: string,
  from: string | null,
  toExclusive: string | null,
) {
  let query = db.from("redemptions").select(columns).eq("store_id", storeId);
  if (from) {
    query = query.gte("redeemed_at", from);
  }
  if (toExclusive) {
    query = query.lt("redeemed_at", toExclusive);
  }
  return query.order("redeemed_at", { ascending: false }).limit(500);
}

export async function listStoreTransactions(
  storeId: string,
  input: { from: string | null; to: string | null; kind: TransactionKind },
  db: Db,
): Promise<StoreTransactionPage> {
  const from = input.from ? dayStart(input.from) : null;
  const toExclusive = input.to ? nextDayStart(input.to) : null;
  let result = await loadRows(db, storeId, WITH_DEMO, from, toExclusive);
  let classificationAvailable = true;
  if (result.error && isMissingColumn(result.error, "demo_only")) {
    classificationAvailable = false;
    result = await loadRows(db, storeId, WITHOUT_DEMO, from, toExclusive);
  }
  if (result.error) {
    if (isMissingRelation(result.error, "redemptions") || isMissingRelation(result.error, "vouchers")) {
      return empty(VOUCHER_SCHEMA_MESSAGE, false);
    }
    throw result.error;
  }

  if (!classificationAvailable && input.kind !== "all") {
    return empty(DEMO_CLASS_UNAVAILABLE, true);
  }

  const mapped = rowsOf<RedemptionRow>(result).map((row) => {
    const voucher = one(row.vouchers);
    const demoOnly = classificationAvailable ? voucher?.demo_only === true : null;
    return {
      id: row.id,
      storeId: row.store_id,
      voucherCode: voucher?.code ?? "",
      giftTitle: voucher?.gift_title ?? "",
      eventTitle: voucher?.event_title ?? "",
      amount: roundMoney(Number(row.amount) || 0),
      redeemedAt: row.redeemed_at,
      channel: row.channel,
      reference: row.reference ?? "",
      settlementStatus: row.settlement_status || "UNSETTLED",
      demoOnly,
      label: demoOnly ? DEMO_REDEMPTION_LABEL : "",
    } satisfies StoreTransaction;
  });

  const rows =
    input.kind === "demo"
      ? mapped.filter((row) => row.demoOnly === true)
      : input.kind === "standard"
        ? mapped.filter((row) => row.demoOnly === false)
        : mapped;

  if (!classificationAvailable) {
    return {
      available: true,
      classificationAvailable: false,
      message: DEMO_CLASS_UNAVAILABLE,
      rows,
      standardGross: null,
      demoGross: null,
    };
  }

  const standardGross = roundMoney(
    rows.filter((row) => row.demoOnly === false).reduce((sum, row) => sum + row.amount, 0),
  );
  const demoGross = roundMoney(
    rows.filter((row) => row.demoOnly === true).reduce((sum, row) => sum + row.amount, 0),
  );
  return {
    available: true,
    classificationAvailable: true,
    message: "",
    rows,
    standardGross,
    demoGross,
  };
}
