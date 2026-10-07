import {
  SETTLEMENT_METHODS,
  type AdminStoreInput,
  type SettlementMethod,
} from "./store-fields";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("הנתונים שנשלחו אינם תקינים.");
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string, max: number) {
  if (typeof value !== "string") {
    throw new Error(`נא למלא ${label}.`);
  }
  const text = value.trim();
  if (!text || text.length > max) {
    throw new Error(`נא למלא ${label}.`);
  }
  return text;
}

function optionalText(value: unknown, label: string, max: number) {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${label} אינו תקין.`);
  }
  const text = value.trim();
  if (!text) {
    return null;
  }
  if (text.length > max) {
    throw new Error(`${label} ארוך מדי.`);
  }
  return text;
}

function optionalUrl(value: unknown, label: string) {
  const text = optionalText(value, label, 500);
  if (!text) {
    return null;
  }
  if (!/^https?:\/\/\S+$/i.test(text)) {
    throw new Error(`${label} חייב להתחיל ב-http:// או https://`);
  }
  return text;
}

function optionalEmail(value: unknown) {
  const text = optionalText(value, "אימייל", 160);
  if (!text) {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    throw new Error("אימייל אינו תקין.");
  }
  return text;
}

function optionalBoolean(value: unknown, label: string) {
  if (value == null || value === "") {
    return null;
  }
  if (value === true || value === false) {
    return value;
  }
  throw new Error(`${label} אינו תקין.`);
}

function optionalInteger(
  value: unknown,
  label: string,
  min: number,
  max: number,
) {
  if (value == null || value === "") {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} אינו תקין.`);
  }
  return number;
}

function optionalPercent(value: unknown) {
  if (value == null || value === "") {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new Error("אחוז העמלה חייב להיות בין 0 ל-100.");
  }
  return Math.round(number * 100) / 100;
}

function optionalSettlement(value: unknown): SettlementMethod | null {
  if (value == null || value === "") {
    return null;
  }
  if (
    typeof value === "string" &&
    SETTLEMENT_METHODS.includes(value as SettlementMethod)
  ) {
    return value as SettlementMethod;
  }
  throw new Error("אופן ההתחשבנות אינו תקין.");
}

export function parseStoreSlug(value: unknown) {
  const slug = requiredText(value, "מזהה באנגלית", 80).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("המזהה באנגלית יכול לכלול אותיות קטנות, מספרים ומקפים.");
  }
  return slug;
}

export function parseAdminStoreInput(value: unknown): AdminStoreInput {
  const body = asRecord(value);
  return {
    name: requiredText(body.name, "שם בית העסק", 120),
    slug: parseStoreSlug(body.slug),
    active: body.active === true,
    logoUrl: optionalUrl(body.logoUrl, "קישור ללוגו"),
    websiteUrl: optionalUrl(body.websiteUrl, "אתר"),
    contactName: optionalText(body.contactName, "שם איש קשר", 120),
    contactPhone: optionalText(body.contactPhone, "טלפון", 40),
    contactEmail: optionalEmail(body.contactEmail),
    commissionPercent: optionalPercent(body.commissionPercent),
    paymentTermsDays: optionalInteger(body.paymentTermsDays, "תנאי תשלום", 0, 3650),
    settlementMethod: optionalSettlement(body.settlementMethod),
    voucherRedemptionMethod: optionalText(
      body.voucherRedemptionMethod,
      "דרך מימוש",
      80,
    ),
    voucherValidityDays: optionalInteger(
      body.voucherValidityDays,
      "תוקף השובר",
      1,
      3650,
    ),
    allowPartialRedemption: optionalBoolean(
      body.allowPartialRedemption,
      "מימוש חלקי",
    ),
    allowCustomerTopup: optionalBoolean(
      body.allowCustomerTopup,
      "השלמת כסף בחנות",
    ),
    notes: optionalText(body.notes, "הערות", 2000),
  };
}

export function parseActiveFlag(value: unknown) {
  const body = asRecord(value);
  if (typeof body.active !== "boolean") {
    throw new Error("סטטוס העסק אינו תקין.");
  }
  return body.active;
}
