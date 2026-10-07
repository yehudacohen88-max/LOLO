export class SettlementActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SettlementActionError";
    this.status = status;
  }
}

export class SettlementSchemaMissingError extends Error {
  constructor() {
    super(SETTLEMENT_SCHEMA_MESSAGE);
    this.name = "SettlementSchemaMissingError";
  }
}

const MESSAGES: Record<string, { text: string; status: number }> = {
  settlement_none: {
    text: "אין מימושים שממתינים להתחשבנות לבית העסק הזה.",
    status: 409,
  },
  settlement_not_found: { text: "ההתחשבנות לא נמצאה.", status: 404 },
  settlement_store_not_found: { text: "בית העסק לא נמצא.", status: 404 },
  settlement_cancelled: {
    text: "ההתחשבנות בוטלה ולא ניתן לסמן אותה כשולמה.",
    status: 409,
  },
  settlement_already_paid: {
    text: "אי אפשר לבטל התחשבנות שכבר סומנה כשולמה.",
    status: 409,
  },
  settlement_closed: { text: "אי אפשר לעדכן התחשבנות סגורה.", status: 409 },
  settlement_reference_invalid: { text: "האסמכתה ארוכה מדי.", status: 400 },
  settlement_method_invalid: { text: "אופן התשלום אינו תקין.", status: 400 },
  settlement_redemption_taken: {
    text: "אחד המימושים כבר נכלל בהתחשבנות אחרת. רעננו את העמוד.",
    status: 409,
  },
  settlement_amount_invalid: { text: "סכום ההתחשבנות אינו תקין.", status: 400 },
  settlement_due_invalid: { text: "תאריך היעד אינו תקין.", status: 400 },
  settlement_terms_invalid: { text: "פרטי ההתחשבנות אינם תקינים.", status: 400 },
  settlement_store_mismatch: { text: "המימוש אינו שייך לבית העסק.", status: 400 },
  settlement_line_immutable: { text: "אי אפשר לשנות שורת התחשבנות.", status: 400 },
  settlement_delete_blocked: { text: "אי אפשר למחוק התחשבנות.", status: 400 },
  settlement_immutable: { text: "אי אפשר לשנות את סכומי ההתחשבנות.", status: 400 },
};

export function settlementErrorCode(message: string) {
  return message.match(/settlement_[a-z0-9_]+/)?.[0] ?? "";
}

export function settlementErrorMessage(code: string) {
  return MESSAGES[code]?.text ?? "לא הצלחנו להשלים את הפעולה. נסו שוב.";
}

export function settlementErrorStatus(code: string) {
  return MESSAGES[code]?.status ?? 400;
}

export const SETTLEMENT_SCHEMA_MESSAGE = "ההתחשבנות עדיין לא הופעלה.";

export function isMissingSettlementSchema(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }
  const code = error.code ?? "";
  const known =
    code === "42P01" ||
    code === "42883" ||
    code === "42703" ||
    code === "PGRST202" ||
    code === "PGRST204" ||
    code === "PGRST205";
  if (!known) {
    return false;
  }
  const message = (error.message ?? "").toLowerCase();
  return message.includes("settlement") || message.includes("redemption");
}
