import type { VoucherTerms } from "@/lib/vouchers/terms";
import type { VoucherStatus } from "@/lib/vouchers/status";

const STATUS_LABELS: Record<VoucherStatus, string> = {
  ISSUED: "פעיל",
  PARTIALLY_REDEEMED: "מומש חלקית",
  REDEEMED: "מומש במלואו",
  EXPIRED: "פג תוקף",
  CANCELLED: "בוטל",
  SETTLEMENT_PENDING: "ממתין להתחשבנות",
  SETTLED: "הוסדר",
};

export function voucherStatusLabel(status: VoucherStatus) {
  return STATUS_LABELS[status];
}

export function markDefault(text: string, isDefault: boolean) {
  return isDefault ? `${text} · ברירת מחדל` : text;
}

export function validityTermLabel(terms: Pick<VoucherTerms, "validityDays" | "validityIsDefault">) {
  return markDefault(
    `${terms.validityDays.toLocaleString("he-IL")} ימים`,
    terms.validityIsDefault,
  );
}

export function partialTermLabel(
  terms: Pick<VoucherTerms, "allowPartialRedemption" | "partialIsDefault">,
) {
  return markDefault(
    terms.allowPartialRedemption ? "אפשר לממש חלק מהסכום" : "מימוש של כל היתרה בלבד",
    terms.partialIsDefault,
  );
}

export function topupTermLabel(
  terms: Pick<VoucherTerms, "allowCustomerTopup" | "topupIsDefault">,
) {
  return markDefault(
    terms.allowCustomerTopup
      ? "אפשר להשלים את ההפרש בחנות"
      : "אי אפשר להשלים סכום בחנות",
    terms.topupIsDefault,
  );
}

export function methodTermLabel(
  terms: Pick<VoucherTerms, "redemptionMethod" | "methodIsDefault">,
) {
  return markDefault(terms.redemptionMethod, terms.methodIsDefault);
}

export function redemptionChannelLabel(channel: string) {
  if (channel === "admin") {
    return "מומש דרך הניהול";
  }
  return "מומש בחנות";
}

export function settlementStatusLabel(status: string) {
  if (status === "SETTLEMENT_PENDING") {
    return "ממתין להתחשבנות";
  }
  if (status === "SETTLED") {
    return "הוסדר";
  }
  return "טרם הוסדר";
}

export function formatVoucherWhen(value: string | number | Date) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toLocaleString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}
