export const SETTLEMENT_METHODS = [
  "bank_transfer",
  "invoice",
  "manual",
  "other",
] as const;

export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number];

export const SETTLEMENT_LABELS: Record<SettlementMethod, string> = {
  bank_transfer: "העברה בנקאית",
  invoice: "חשבונית",
  manual: "ידני",
  other: "אחר",
};

export const PAYMENT_TERM_PRESETS = [0, 30, 45, 60] as const;

export type AdminStore = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  logoUrl: string | null;
  websiteUrl: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  commissionPercent: number | null;
  paymentTermsDays: number | null;
  settlementMethod: SettlementMethod | null;
  voucherRedemptionMethod: string | null;
  voucherValidityDays: number | null;
  allowPartialRedemption: boolean | null;
  allowCustomerTopup: boolean | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminStoreInput = Omit<AdminStore, "id" | "createdAt" | "updatedAt">;

export function settlementLabel(method: SettlementMethod | null) {
  return method ? SETTLEMENT_LABELS[method] : "לא הוגדר";
}

export function paymentTermsLabel(days: number | null) {
  if (days == null) {
    return "לא הוגדר";
  }
  if (days === 0) {
    return "מיידי";
  }
  return `${days} יום`;
}

export function commissionLabel(percent: number | null) {
  if (percent == null) {
    return "לא הוגדר";
  }
  return `${percent.toLocaleString("he-IL")}%`;
}

export function triStateLabel(value: boolean | null) {
  if (value == null) {
    return "לא הוגדר";
  }
  return value ? "כן" : "לא";
}
