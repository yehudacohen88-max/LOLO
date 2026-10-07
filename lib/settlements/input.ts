import { SETTLEMENT_METHODS, type SettlementMethod } from "@/lib/admin/store-fields";
import { isUuid } from "@/lib/vouchers/input";

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("הנתונים שנשלחו אינם תקינים.");
  }
  return value as Record<string, unknown>;
}

function requiredUuid(value: unknown, label: string) {
  if (typeof value !== "string" || !isUuid(value)) {
    throw new Error(`${label} אינו תקין.`);
  }
  return value;
}

export function parseCreateSettlementInput(value: unknown) {
  const body = asRecord(value);
  return {
    storeId: requiredUuid(body.storeId, "בית העסק"),
    idempotencyKey: requiredUuid(body.idempotencyKey, "בקשת ההתחשבנות"),
  };
}

export function parsePaySettlementInput(value: unknown) {
  const body = asRecord(value);
  let reference: string | null = null;
  if (typeof body.reference === "string" && body.reference.trim()) {
    reference = body.reference.trim();
    if (reference.length > 80) {
      throw new Error("האסמכתה ארוכה מדי.");
    }
  }

  let method: SettlementMethod | null = null;
  if (body.method != null && body.method !== "") {
    if (typeof body.method !== "string" || !SETTLEMENT_METHODS.includes(body.method as SettlementMethod)) {
      throw new Error("אופן התשלום אינו תקין.");
    }
    method = body.method as SettlementMethod;
  }

  return { reference, method };
}
