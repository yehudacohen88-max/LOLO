export class VoucherActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "VoucherActionError";
    this.status = status;
  }
}

export class VoucherSchemaMissingError extends Error {
  constructor() {
    super(VOUCHER_SCHEMA_MESSAGE);
    this.name = "VoucherSchemaMissingError";
  }
}

const MESSAGES: Record<string, { text: string; status: number }> = {
  voucher_none_available: {
    text: "אין סכום ששולם שעדיין לא הונפק בשובר.",
    status: 409,
  },
  voucher_amount_changed: {
    text: "הסכום להנפקה השתנה. רעננו את העמוד ונסו שוב.",
    status: 409,
  },
  voucher_terms_changed: {
    text: "תנאי בית העסק התעדכנו. רעננו את העמוד ונסו שוב.",
    status: 409,
  },
  voucher_gift_not_found: { text: "המתנה לא נמצאה.", status: 404 },
  voucher_store_inactive: { text: "בית העסק אינו פעיל.", status: 400 },
  voucher_store_mismatch: {
    text: "השובר חייב להיות לבית העסק של המתנה.",
    status: 400,
  },
  voucher_not_found: { text: "השובר לא נמצא.", status: 404 },
  voucher_expired: { text: "פג תוקף השובר.", status: 400 },
  voucher_closed: { text: "אי אפשר לממש את השובר הזה.", status: 400 },
  voucher_partial_disabled: {
    text: "בית העסק מאפשר מימוש של כל היתרה בלבד.",
    status: 400,
  },
  voucher_amount_invalid: { text: "הסכום למימוש אינו תקין.", status: 400 },
  voucher_cancel_blocked: { text: "אי אפשר לבטל שובר שכבר מומש.", status: 400 },
  voucher_over_issue: { text: "אי אפשר להנפיק יותר מהסכום ששולם.", status: 409 },
  voucher_code_collision: { text: "לא הצלחנו להנפיק שובר. נסו שוב.", status: 409 },
  voucher_reference_invalid: { text: "ההערה ארוכה מדי.", status: 400 },
  voucher_terms_invalid: { text: "תנאי השובר אינם תקינים.", status: 400 },
  voucher_store_required: { text: "יש לבחור בית עסק פעיל.", status: 400 },
};

export function voucherErrorCode(message: string) {
  return message.match(/voucher_[a-z0-9_]+/)?.[0] ?? "";
}

export function voucherErrorMessage(code: string) {
  return MESSAGES[code]?.text ?? "לא הצלחנו להשלים את הפעולה. נסו שוב.";
}

export function voucherErrorStatus(code: string) {
  return MESSAGES[code]?.status ?? 400;
}

export const VOUCHER_SCHEMA_MESSAGE = "הנפקת השוברים עדיין לא הופעלה.";

export function isMissingVoucherSchema(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }
  const code = error.code ?? "";
  return (
    code === "42P01" ||
    code === "42883" ||
    code === "42703" ||
    code === "PGRST202" ||
    code === "PGRST204" ||
    code === "PGRST205"
  );
}
