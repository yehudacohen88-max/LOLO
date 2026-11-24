import {
  commissionLabel,
  paymentTermsLabel,
  settlementLabel,
  triStateLabel,
  type AdminStore,
} from "@/lib/admin/store-fields";
import { getAdminStore } from "@/lib/admin/stores";
import type { Db } from "@/lib/desk/db";
import { DeskError, STORE_LOCKED_FIELDS } from "@/lib/desk/messages";

const LOCKED_KEYS = [
  "slug",
  "active",
  "logoUrl",
  "logo_url",
  "commissionPercent",
  "commission_percent",
  "paymentTermsDays",
  "payment_terms_days",
  "settlementMethod",
  "settlement_method",
  "voucherRedemptionMethod",
  "voucher_redemption_method",
  "voucherValidityDays",
  "voucher_validity_days",
  "allowPartialRedemption",
  "allow_partial_redemption",
  "allowCustomerTopup",
  "allow_customer_topup",
  "notes",
] as const;

export type StoreChecklistItem = {
  key: string;
  label: string;
  done: boolean;
};

export type StoreSelfProfile = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  websiteUrl: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  commissionLabel: string;
  paymentTermsLabel: string;
  settlementLabel: string;
  voucherRedemptionMethod: string;
  voucherValidityLabel: string;
  partialLabel: string;
  topupLabel: string;
  checklist: StoreChecklistItem[];
};

export type StoreSelfPatch = {
  name: string;
  websiteUrl: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DeskError("הנתונים שנשלחו אינם תקינים.");
  }
  return value as Record<string, unknown>;
}

function optionalText(value: unknown, label: string, max: number) {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new DeskError(`${label} אינו תקין.`);
  }
  const text = value.trim();
  if (!text) {
    return null;
  }
  if (text.length > max) {
    throw new DeskError(`${label} ארוך מדי.`);
  }
  return text;
}

function optionalUrl(value: unknown) {
  const text = optionalText(value, "אתר", 500);
  if (!text) {
    return null;
  }
  if (!/^https?:\/\/\S+$/i.test(text)) {
    throw new DeskError("אתר חייב להתחיל ב-http:// או https://");
  }
  return text;
}

function optionalEmail(value: unknown) {
  const text = optionalText(value, "אימייל", 160);
  if (!text) {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    throw new DeskError("אימייל אינו תקין.");
  }
  return text;
}

export function parseStoreSelfPatch(value: unknown): StoreSelfPatch {
  const body = asRecord(value);
  for (const key of LOCKED_KEYS) {
    if (key in body) {
      throw new DeskError(STORE_LOCKED_FIELDS);
    }
  }
  if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) {
    throw new DeskError("נא למלא שם העסק.");
  }
  return {
    name: body.name.trim(),
    websiteUrl: optionalUrl(body.websiteUrl),
    contactName: optionalText(body.contactName, "איש קשר", 120),
    contactPhone: optionalText(body.contactPhone, "טלפון", 40),
    contactEmail: optionalEmail(body.contactEmail),
  };
}

export function toSelfProfile(store: AdminStore): StoreSelfProfile {
  const checklist: StoreChecklistItem[] = [
    { key: "name", label: "שם העסק", done: store.name.trim().length > 0 },
    { key: "contactName", label: "איש קשר", done: Boolean(store.contactName) },
    { key: "contactPhone", label: "טלפון", done: Boolean(store.contactPhone) },
    { key: "contactEmail", label: "אימייל", done: Boolean(store.contactEmail) },
    { key: "website", label: "אתר", done: Boolean(store.websiteUrl) },
  ];
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    active: store.active,
    websiteUrl: store.websiteUrl,
    contactName: store.contactName,
    contactPhone: store.contactPhone,
    contactEmail: store.contactEmail,
    commissionLabel: commissionLabel(store.commissionPercent),
    paymentTermsLabel: paymentTermsLabel(store.paymentTermsDays),
    settlementLabel: settlementLabel(store.settlementMethod),
    voucherRedemptionMethod: store.voucherRedemptionMethod?.trim() || "לא הוגדר",
    voucherValidityLabel:
      store.voucherValidityDays == null
        ? "לא הוגדר"
        : `${store.voucherValidityDays.toLocaleString("he-IL")} יום`,
    partialLabel: triStateLabel(store.allowPartialRedemption),
    topupLabel: triStateLabel(store.allowCustomerTopup),
    checklist,
  };
}

export async function readStoreSelfProfile(storeId: string) {
  const store = await getAdminStore(storeId);
  return store ? toSelfProfile(store) : null;
}

export async function updateStoreSelfProfile(storeId: string, patch: StoreSelfPatch, db: Db) {
  const result = await db
    .from("stores")
    .update({
      name: patch.name,
      website_url: patch.websiteUrl,
      contact_name: patch.contactName,
      contact_phone: patch.contactPhone,
      contact_email: patch.contactEmail,
    })
    .eq("id", storeId)
    .select("id")
    .maybeSingle();
  if (result.error) {
    throw result.error;
  }
  if (!result.data) {
    throw new DeskError("בית העסק לא נמצא.", 404);
  }
}
