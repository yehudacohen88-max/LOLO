import "server-only";
import { roundMoney } from "@/lib/money";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { isMissingVoucherSchema } from "@/lib/vouchers/messages";
import type { RefundVoucherSlice } from "@/lib/vouchers/refund-release";
import type { StoredOrder } from "@/lib/orders/types";
import { createDemoPaymentReference } from "./reference";
import type { DemoRefundRecord } from "./demo-refund";
import { DEMO_PROVIDER_NAME } from "./demo-provider-name";
import {
  PaymentsNotEnabledError,
  rethrowIfPaymentsSchema,
} from "./messages";

type DbError = { code?: string; message?: string; details?: string };

export type StoredAttempt = {
  id: string;
  orderId: string;
  provider: string;
  idempotencyKey: string;
  providerReference: string | null;
  providerEventId: string | null;
  kind: string;
  status: string;
  amount: number;
  simulated: boolean;
  paidAt: string | null;
};

type AttemptInsert = {
  orderId: string;
  idempotencyKey: string;
  providerReference: string | null;
  providerEventId: string | null;
  kind: "start" | "confirm" | "webhook" | "cancel";
  status: "started" | "succeeded" | "failed" | "cancelled";
  amount: number;
  paidAt: string | null;
};

function dbError(error: DbError | null) {
  return {
    code: error?.code,
    message: error?.message,
    details: error?.details,
  };
}

function conflictName(error: DbError) {
  return `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
}

function mapAttempt(row: {
  id: string;
  order_id: string;
  provider: string;
  idempotency_key: string;
  provider_reference: string | null;
  provider_event_id: string | null;
  kind: string;
  status: string;
  amount: number | string;
  simulated: boolean;
  paid_at: string | null;
}): StoredAttempt {
  return {
    id: row.id,
    orderId: row.order_id,
    provider: row.provider,
    idempotencyKey: row.idempotency_key,
    providerReference: row.provider_reference,
    providerEventId: row.provider_event_id,
    kind: row.kind,
    status: row.status,
    amount: roundMoney(Number(row.amount) || 0),
    simulated: row.simulated === true,
    paidAt: row.paid_at,
  };
}

async function findAttempt(filter: {
  orderId?: string;
  idempotencyKey?: string;
  providerEventId?: string;
  succeededOnly?: boolean;
}) {
  const supabase = getSupabaseServiceClient();
  let query = supabase.from("payment_attempts").select("*").eq("provider", DEMO_PROVIDER_NAME);
  if (filter.orderId) {
    query = query.eq("order_id", filter.orderId);
  }
  if (filter.idempotencyKey) {
    query = query.eq("idempotency_key", filter.idempotencyKey);
  }
  if (filter.providerEventId) {
    query = query.eq("provider_event_id", filter.providerEventId);
  }
  if (filter.succeededOnly) {
    query = query.eq("status", "succeeded");
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    rethrowIfPaymentsSchema(error);
    console.error("[LOLO] payment attempt lookup failed", dbError(error));
    throw new Error("לא ניתן לקרוא את ניסיון התשלום.");
  }
  return data ? mapAttempt(data as Parameters<typeof mapAttempt>[0]) : null;
}

export async function recordAttempt(input: AttemptInsert): Promise<{ attempt: StoredAttempt; replayed: boolean }> {
  const row = {
    order_id: input.orderId,
    provider: DEMO_PROVIDER_NAME,
    idempotency_key: input.idempotencyKey,
    provider_reference: input.providerReference,
    provider_event_id: input.providerEventId,
    kind: input.kind,
    status: input.status,
    amount: input.amount,
    simulated: true,
    paid_at: input.paidAt,
  };
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from("payment_attempts").insert(row).select("*").maybeSingle();
  if (!error && data) {
    const attempt = mapAttempt(data as Parameters<typeof mapAttempt>[0]);
    if (!attempt.simulated || attempt.provider !== DEMO_PROVIDER_NAME) {
      throw new PaymentsNotEnabledError();
    }
    return { attempt, replayed: false };
  }
  if (error) {
    rethrowIfPaymentsSchema(error);
    if (error.code === "23505") {
      const name = conflictName(error);
      if (name.includes("provider_reference")) {
        throw new Error("אישור התשלום נכשל. נסו שוב.");
      }
      const byEvent = input.providerEventId
        ? await findAttempt({ providerEventId: input.providerEventId })
        : null;
      if (byEvent) {
        return { attempt: byEvent, replayed: true };
      }
      const byKey = await findAttempt({
        orderId: input.orderId,
        idempotencyKey: input.idempotencyKey,
      });
      if (byKey) {
        return { attempt: byKey, replayed: true };
      }
      const winner = await findAttempt({ orderId: input.orderId, succeededOnly: true });
      if (winner) {
        return { attempt: winner, replayed: true };
      }
    }
    console.error("[LOLO] payment attempt insert failed", dbError(error));
  }
  throw new Error("לא ניתן לרשום את ניסיון התשלום.");
}

export async function recordSucceededCapture(input: {
  orderId: string;
  idempotencyKey: string;
  providerEventId: string | null;
  kind: "confirm" | "webhook";
  amount: number;
  paidAt: string;
  providerReference?: string;
}) {
  const reference = input.providerReference ?? createDemoPaymentReference();
  try {
    return await recordAttempt({
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      providerReference: reference,
      providerEventId: input.providerEventId,
      kind: input.kind,
      status: "succeeded",
      amount: input.amount,
      paidAt: input.paidAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "אישור התשלום נכשל. נסו שוב.") {
      return recordAttempt({
        orderId: input.orderId,
        idempotencyKey: input.idempotencyKey,
        providerReference: createDemoPaymentReference(),
        providerEventId: input.providerEventId,
        kind: input.kind,
        status: "succeeded",
        amount: input.amount,
        paidAt: input.paidAt,
      });
    }
    throw error;
  }
}

function mapRefund(row: {
  order_id: string;
  amount: number | string;
  provider: string;
  provider_reference: string;
  payment_reference: string;
  idempotency_key: string;
  reason: string | null;
  approver: DemoRefundRecord["approver"];
  policy_window_days: number;
  policy_allow_partial: boolean;
  policy_blocks_issued_voucher: boolean;
}): DemoRefundRecord {
  if (row.provider !== DEMO_PROVIDER_NAME) {
    throw new PaymentsNotEnabledError();
  }
  return {
    orderId: row.order_id,
    amount: roundMoney(Number(row.amount) || 0),
    provider: DEMO_PROVIDER_NAME,
    providerReference: row.provider_reference,
    paymentReference: row.payment_reference,
    idempotencyKey: row.idempotency_key,
    simulated: true,
    status: "recorded",
    reason: row.reason ?? "",
    approver: row.approver,
    policyWindowDays: row.policy_window_days,
    policyAllowPartial: row.policy_allow_partial,
    policyBlocksIssuedVoucher: row.policy_blocks_issued_voucher,
    externalUrl: null,
    replayed: false,
  };
}

export async function findRefund(orderId: string, idempotencyKey: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("payment_refunds")
    .select("*")
    .eq("order_id", orderId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) {
    rethrowIfPaymentsSchema(error);
    console.error("[LOLO] payment refund lookup failed", dbError(error));
    throw new Error("לא ניתן לקרוא את ההחזר.");
  }
  return data ? mapRefund(data as Parameters<typeof mapRefund>[0]) : null;
}

export async function sumRecordedRefunds(orderId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("payment_refunds")
    .select("amount")
    .eq("order_id", orderId)
    .eq("status", "recorded");
  if (error) {
    rethrowIfPaymentsSchema(error);
    console.error("[LOLO] payment refund sum failed", dbError(error));
    throw new Error("לא ניתן לקרוא את ההחזר.");
  }
  return roundMoney(
    (data ?? []).reduce((sum, row) => sum + roundMoney(Number(row.amount) || 0), 0),
  );
}

export async function insertRefund(record: DemoRefundRecord) {
  if (record.provider !== DEMO_PROVIDER_NAME || record.simulated !== true || record.externalUrl !== null) {
    throw new PaymentsNotEnabledError();
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("payment_refunds")
    .insert({
      order_id: record.orderId,
      provider: DEMO_PROVIDER_NAME,
      provider_reference: record.providerReference,
      payment_reference: record.paymentReference,
      idempotency_key: record.idempotencyKey,
      amount: record.amount,
      status: "recorded",
      simulated: true,
      reason: record.reason || null,
      approver: record.approver,
      policy_window_days: record.policyWindowDays,
      policy_allow_partial: record.policyAllowPartial,
      policy_blocks_issued_voucher: record.policyBlocksIssuedVoucher,
    })
    .select("*")
    .maybeSingle();
  if (!error && data) {
    return mapRefund(data as Parameters<typeof mapRefund>[0]);
  }
  if (error) {
    rethrowIfPaymentsSchema(error);
    if (error.code === "23505") {
      const existing = await findRefund(record.orderId, record.idempotencyKey);
      if (existing) {
        return { ...existing, replayed: true };
      }
    }
    console.error("[LOLO] payment refund insert failed", dbError(error));
  }
  throw new Error("לא ניתן לרשום את ההחזר.");
}

export async function loadRefundVoucherSlices(giftIds: string[]): Promise<RefundVoucherSlice[]> {
  if (giftIds.length === 0) {
    return [];
  }
  const supabase = getSupabaseServiceClient();
  const vouchers = await supabase
    .from("vouchers")
    .select("id, status, amount, remaining_amount")
    .in("gift_id", giftIds);
  if (vouchers.error) {
    if (isMissingVoucherSchema(vouchers.error)) {
      throw new Error("לא ניתן לבדוק אם הונפק שובר, ולכן ההחזר נעצר.");
    }
    console.error("[LOLO] voucher lookup for refund failed", dbError(vouchers.error));
    throw new Error("לא ניתן לבדוק אם הונפק שובר, ולכן ההחזר נעצר.");
  }
  const rows = (vouchers.data ?? []) as Array<{
    id: string;
    status: string;
    amount: number | string;
    remaining_amount: number | string;
  }>;
  const counts = new Map<string, number>();
  if (rows.length > 0) {
    const redemptions = await supabase
      .from("redemptions")
      .select("voucher_id")
      .in(
        "voucher_id",
        rows.map((row) => row.id),
      );
    if (redemptions.error) {
      if (isMissingVoucherSchema(redemptions.error)) {
        throw new Error("לא ניתן לבדוק אם הונפק שובר, ולכן ההחזר נעצר.");
      }
      console.error("[LOLO] redemption lookup for refund failed", dbError(redemptions.error));
      throw new Error("לא ניתן לבדוק אם הונפק שובר, ולכן ההחזר נעצר.");
    }
    for (const row of (redemptions.data ?? []) as Array<{ voucher_id: string }>) {
      counts.set(row.voucher_id, (counts.get(row.voucher_id) ?? 0) + 1);
    }
  }
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    amount: roundMoney(Number(row.amount) || 0),
    remainingAmount: roundMoney(Number(row.remaining_amount) || 0),
    redemptionCount: counts.get(row.id) ?? 0,
  }));
}

export async function attachRefundSummary(order: StoredOrder): Promise<StoredOrder> {
  try {
    const refundedAmount = await sumRecordedRefunds(order.id);
    if (!(refundedAmount > 0)) {
      return { ...order, refundedAmount: 0, refundStatus: "none" };
    }
    const full = refundedAmount >= roundMoney(order.chargedAmount) && order.chargedAmount > 0;
    return {
      ...order,
      refundedAmount,
      refundStatus: full ? "full" : "partial",
    };
  } catch (error) {
    if (error instanceof PaymentsNotEnabledError) {
      return order;
    }
    console.error("[LOLO] refund summary skipped", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return order;
  }
}
