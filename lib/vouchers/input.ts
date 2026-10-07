import { roundMoney } from "@/lib/money";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

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

export type IssueVoucherInput = {
  giftId: string;
  storeId: string;
  expectedAmount: number;
  idempotencyKey: string;
  validityDays: number;
  allowPartialRedemption: boolean;
  allowCustomerTopup: boolean;
  redemptionMethod: string;
};

export function parseIssueVoucherInput(value: unknown): IssueVoucherInput {
  const body = asRecord(value);
  const expected = typeof body.expectedAmount === "number" ? body.expectedAmount : Number(body.expectedAmount);
  if (!Number.isFinite(expected) || expected <= 0) {
    throw new Error("הסכום להנפקה אינו תקין.");
  }
  const validity = typeof body.validityDays === "number" ? body.validityDays : Number(body.validityDays);
  if (!Number.isInteger(validity) || validity < 1 || validity > 3650) {
    throw new Error("תוקף השובר אינו תקין.");
  }
  if (typeof body.allowPartialRedemption !== "boolean") {
    throw new Error("הגדרת המימוש החלקי אינה תקינה.");
  }
  if (typeof body.allowCustomerTopup !== "boolean") {
    throw new Error("הגדרת ההשלמה בחנות אינה תקינה.");
  }
  if (typeof body.redemptionMethod !== "string" || !body.redemptionMethod.trim()) {
    throw new Error("דרך המימוש אינה תקינה.");
  }
  if (body.redemptionMethod.trim().length > 80) {
    throw new Error("דרך המימוש ארוכה מדי.");
  }

  return {
    giftId: requiredUuid(body.giftId, "המתנה"),
    storeId: requiredUuid(body.storeId, "בית העסק"),
    expectedAmount: roundMoney(expected),
    idempotencyKey: requiredUuid(body.idempotencyKey, "בקשת ההנפקה"),
    validityDays: validity,
    allowPartialRedemption: body.allowPartialRedemption,
    allowCustomerTopup: body.allowCustomerTopup,
    redemptionMethod: body.redemptionMethod.trim(),
  };
}

export type RedeemVoucherInput = {
  code: string;
  amount: number | null;
  reference: string | null;
};

export function parseRedeemVoucherInput(value: unknown): RedeemVoucherInput {
  const body = asRecord(value);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code || code.length > 200) {
    throw new Error("יש להזין קוד שובר.");
  }

  let amount: number | null = null;
  if (body.amount != null && body.amount !== "") {
    const parsed = typeof body.amount === "number" ? body.amount : Number(body.amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("הסכום למימוש אינו תקין.");
    }
    amount = roundMoney(parsed);
  }

  let reference: string | null = null;
  if (typeof body.reference === "string" && body.reference.trim()) {
    reference = body.reference.trim();
    if (reference.length > 80) {
      throw new Error("ההערה ארוכה מדי.");
    }
  }

  return { code, amount, reference };
}

export function parseOptionalReference(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const reference = value.trim();
  if (reference.length > 80) {
    throw new Error("ההערה ארוכה מדי.");
  }
  return reference;
}

export function parseOptionalAmount(value: unknown) {
  if (value == null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("הסכום למימוש אינו תקין.");
  }
  return roundMoney(parsed);
}

export function safeImageUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}
