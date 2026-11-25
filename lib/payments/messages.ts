export const PAYMENTS_LEDGER_NOT_ENABLED = "רישום התשלומים עדיין לא הופעל.";

export const PAYMENTS_LIVE_NOT_ENABLED = "אמצעי התשלום הזה עדיין לא הופעל.";

export const WEBHOOK_NOT_ENABLED = "אימות עדכוני התשלום עדיין לא הופעל.";

export const WEBHOOK_BAD_SIGNATURE = "חתימת עדכון התשלום אינה תקינה.";

export const WEBHOOK_BAD_PAYLOAD = "עדכון התשלום אינו תקין.";

export const REFUND_POLICY_NOT_CONFIGURED = "מדיניות ההחזרים עדיין לא הוגדרה.";

export const REFUND_DISABLED = "החזרים אינם זמינים לפי המדיניות.";

export const REFUND_FORBIDDEN = "אין הרשאה לבצע את ההחזר.";

export const REFUND_WINDOW_CLOSED = "חלון ההחזרים נסגר.";

export const REFUND_VOUCHER_BLOCKED = "אי אפשר להחזיר כל עוד יש שובר שהונפק על ההזמנה.";

export const REFUND_FULL_ONLY = "מדיניות ההחזרים מאפשרת החזר מלא בלבד.";

export const REFUND_AMOUNT_INVALID = "סכום ההחזר אינו תקין.";

export const REFUND_DEMO_ONLY = "החזר זמין כרגע רק לתשלום הדגמה.";

export const REFUND_DEMO_NO_NETWORK = "תשלום הדגמה לא פונה לספק חי.";

export const DEMO_CANNOT_BE_REAL_MONEY = "תשלום הדגמה לא יכול להיספר ככסף.";

export const CANCEL_PAID_REFUSED = "הזמנה ששולמה לא מבוטלת מכאן.";

export const ORDER_CANCELLED = "ההזמנה בוטלה.";

export const IDEMPOTENCY_KEY_INVALID = "מפתח הבקשה אינו תקין.";

export class PaymentsNotEnabledError extends Error {
  constructor(message = PAYMENTS_LEDGER_NOT_ENABLED) {
    super(message);
    this.name = "PaymentsNotEnabledError";
  }
}

const loggedSchema = new Set<string>();

export function isMissingPaymentsSchema(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }
  const code = error.code ?? "";
  const known =
    code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205";
  if (!known) {
    return false;
  }
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("payment_attempt") ||
    message.includes("payment_refund") ||
    message.includes("refund_window_days") ||
    message.includes("refund_approver") ||
    message.includes("refund_allow_partial") ||
    message.includes("refund_blocks_issued_voucher")
  );
}

export function rethrowIfPaymentsSchema(error: { code?: string; message?: string } | null) {
  if (!isMissingPaymentsSchema(error)) {
    return;
  }
  const key = `${error?.code ?? ""}:${error?.message ?? ""}`;
  if (!loggedSchema.has(key)) {
    loggedSchema.add(key);
    console.error(
      "[LOLO] Payment ledger schema is missing. Run supabase/payments-attempts.sql in the Supabase SQL editor after approval.",
      { code: error?.code, message: error?.message },
    );
  }
  throw new PaymentsNotEnabledError();
}
