import type { Db } from "@/lib/desk/db";
import { isMissingColumn, isMissingRelation, rowsOf } from "@/lib/desk/db";
import { PAYMENTS_LEDGER_UNAVAILABLE } from "@/lib/desk/messages";
import { roundMoney } from "@/lib/money";

export type PaymentAttemptView = {
  id: string;
  orderId: string;
  provider: string;
  reference: string;
  kind: string;
  status: string;
  amount: number;
  simulated: boolean;
  paidAt: string | null;
  createdAt: string;
};

export type PaymentRefundView = {
  id: string;
  orderId: string;
  provider: string;
  reference: string;
  amount: number;
  status: string;
  simulated: boolean;
  reason: string;
  approver: string;
  createdAt: string;
};

export type LedgerPage<T> =
  | { available: false; message: string; rows: [] }
  | { available: true; message: ""; rows: T[] };

const ATTEMPT_COLUMNS =
  "id, order_id, provider, provider_reference, kind, status, amount, simulated, paid_at, created_at";

const REFUND_COLUMNS =
  "id, order_id, provider, provider_reference, amount, status, simulated, reason, approver, created_at";

type AttemptRow = {
  id: string;
  order_id: string;
  provider: string;
  provider_reference: string | null;
  kind: string;
  status: string;
  amount: number | string;
  simulated: boolean;
  paid_at: string | null;
  created_at: string;
};

type RefundRow = {
  id: string;
  order_id: string;
  provider: string;
  provider_reference: string | null;
  amount: number | string;
  status: string;
  simulated: boolean;
  reason: string | null;
  approver: string;
  created_at: string;
};

function closed<T>(): LedgerPage<T> {
  return { available: false, message: PAYMENTS_LEDGER_UNAVAILABLE, rows: [] };
}

export async function listPaymentAttempts(
  db: Db,
  orderId?: string,
): Promise<LedgerPage<PaymentAttemptView>> {
  let query = db
    .from("payment_attempts")
    .select(ATTEMPT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (orderId) {
    query = query.eq("order_id", orderId);
  }
  const result = await query;
  if (result.error) {
    if (
      isMissingRelation(result.error, "payment_attempts") ||
      isMissingColumn(result.error, "simulated")
    ) {
      return closed();
    }
    throw result.error;
  }
  return {
    available: true,
    message: "",
    rows: rowsOf<AttemptRow>(result).map((row) => ({
      id: row.id,
      orderId: row.order_id,
      provider: row.provider,
      reference: row.provider_reference ?? "",
      kind: row.kind,
      status: row.status,
      amount: roundMoney(Number(row.amount) || 0),
      simulated: row.simulated === true,
      paidAt: row.paid_at,
      createdAt: row.created_at,
    })),
  };
}

export async function listPaymentRefunds(
  db: Db,
  orderId?: string,
): Promise<LedgerPage<PaymentRefundView>> {
  let query = db
    .from("payment_refunds")
    .select(REFUND_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (orderId) {
    query = query.eq("order_id", orderId);
  }
  const result = await query;
  if (result.error) {
    if (
      isMissingRelation(result.error, "payment_refunds") ||
      isMissingColumn(result.error, "simulated")
    ) {
      return closed();
    }
    throw result.error;
  }
  return {
    available: true,
    message: "",
    rows: rowsOf<RefundRow>(result).map((row) => ({
      id: row.id,
      orderId: row.order_id,
      provider: row.provider,
      reference: row.provider_reference ?? "",
      amount: roundMoney(Number(row.amount) || 0),
      status: row.status,
      simulated: row.simulated === true,
      reason: row.reason ?? "",
      approver: row.approver,
      createdAt: row.created_at,
    })),
  };
}

export function paymentDemoLabel(simulated: boolean) {
  return simulated ? "הדגמה" : "לא מסומן כהדגמה";
}
