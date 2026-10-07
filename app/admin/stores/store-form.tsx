"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  PAYMENT_TERM_PRESETS,
  SETTLEMENT_METHODS,
  SETTLEMENT_LABELS,
  type AdminStore,
} from "@/lib/admin/store-fields";
import { VOUCHER_TERM_DEFAULTS } from "@/lib/vouchers/terms";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

function triValue(value: boolean | null | undefined) {
  if (value == null) {
    return "";
  }
  return value ? "true" : "false";
}

function readTriState(value: string) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

export default function StoreForm({ store }: { store?: AdminStore }) {
  const router = useRouter();
  const presetTerms = PAYMENT_TERM_PRESETS.map(String);
  const initialTerms =
    store?.paymentTermsDays == null
      ? ""
      : presetTerms.includes(String(store.paymentTermsDays))
        ? String(store.paymentTermsDays)
        : "custom";
  const [name, setName] = useState(store?.name ?? "");
  const [slug, setSlug] = useState(store?.slug ?? "");
  const [active, setActive] = useState(store?.active ?? true);
  const [logoUrl, setLogoUrl] = useState(store?.logoUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(store?.websiteUrl ?? "");
  const [contactName, setContactName] = useState(store?.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(store?.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(store?.contactEmail ?? "");
  const [commissionPercent, setCommissionPercent] = useState(
    store?.commissionPercent == null ? "" : String(store.commissionPercent),
  );
  const [paymentTermsChoice, setPaymentTermsChoice] = useState(initialTerms);
  const [customPaymentTerms, setCustomPaymentTerms] = useState(
    initialTerms === "custom" ? String(store?.paymentTermsDays ?? "") : "",
  );
  const [settlementMethod, setSettlementMethod] = useState<string>(
    store?.settlementMethod ?? "",
  );
  const [voucherRedemptionMethod, setVoucherRedemptionMethod] = useState(
    store?.voucherRedemptionMethod ?? "",
  );
  const [voucherValidityDays, setVoucherValidityDays] = useState(
    store?.voucherValidityDays == null ? "" : String(store.voucherValidityDays),
  );
  const [allowPartialRedemption, setAllowPartialRedemption] = useState(
    triValue(store?.allowPartialRedemption),
  );
  const [allowCustomerTopup, setAllowCustomerTopup] = useState(
    triValue(store?.allowCustomerTopup),
  );
  const [notes, setNotes] = useState(store?.notes ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function paymentTermsDays() {
    if (!paymentTermsChoice) {
      return null;
    }
    if (paymentTermsChoice === "custom") {
      return customPaymentTerms.trim() === "" ? null : Number(customPaymentTerms);
    }
    return Number(paymentTermsChoice);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    const payload = {
      name,
      slug,
      active,
      logoUrl,
      websiteUrl,
      contactName,
      contactPhone,
      contactEmail,
      commissionPercent: commissionPercent.trim() === "" ? null : Number(commissionPercent),
      paymentTermsDays: paymentTermsDays(),
      settlementMethod: settlementMethod || null,
      voucherRedemptionMethod,
      voucherValidityDays:
        voucherValidityDays.trim() === "" ? null : Number(voucherValidityDays),
      allowPartialRedemption: readTriState(allowPartialRedemption),
      allowCustomerTopup: readTriState(allowCustomerTopup),
      notes,
    };

    try {
      const response = await fetch(
        store ? `/api/admin/stores/${store.id}` : "/api/admin/stores",
        {
          method: store ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "שמירת בית העסק נכשלה.");
      }
      router.push("/admin/stores");
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "שמירת בית העסק נכשלה.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-foreground">פרטי העסק</h2>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">שם בית העסק</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">שם כניסה לחנות</span>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            dir="ltr"
            placeholder="bike-shop"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={fieldClass}
          />
          <span className="text-xs leading-relaxed text-muted">
            אותיות באנגלית, מספרים ומקפים. החנות מזינה את השם הזה במסך המימוש.
          </span>
        </label>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          פעיל ומוצג לבעלי אירועים
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">קישור ללוגו</span>
          <input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} dir="ltr" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">אתר</span>
          <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} dir="ltr" className={fieldClass} />
        </label>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-foreground">איש קשר</h2>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">שם</span>
          <input value={contactName} onChange={(event) => setContactName(event.target.value)} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">טלפון</span>
          <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} dir="ltr" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">אימייל</span>
          <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} dir="ltr" className={fieldClass} />
        </label>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-foreground">התחשבנות</h2>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">עמלה באחוזים</span>
          <input
            value={commissionPercent}
            onChange={(event) => setCommissionPercent(event.target.value)}
            inputMode="decimal"
            dir="ltr"
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">תנאי תשלום</span>
          <select
            value={paymentTermsChoice}
            onChange={(event) => setPaymentTermsChoice(event.target.value)}
            className={fieldClass}
          >
            <option value="">לא הוגדר</option>
            <option value="0">מיידי</option>
            <option value="30">30 יום</option>
            <option value="45">45 יום</option>
            <option value="60">60 יום</option>
            <option value="custom">מספר אחר</option>
          </select>
        </label>
        {paymentTermsChoice === "custom" ? (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">מספר ימים</span>
            <input
              value={customPaymentTerms}
              onChange={(event) => setCustomPaymentTerms(event.target.value)}
              inputMode="numeric"
              dir="ltr"
              className={fieldClass}
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">אופן התחשבנות</span>
          <select
            value={settlementMethod}
            onChange={(event) => setSettlementMethod(event.target.value)}
            className={fieldClass}
          >
            <option value="">לא הוגדר</option>
            {SETTLEMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {SETTLEMENT_LABELS[method]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">הערות להסכם</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="rounded-2xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none focus:border-brand"
          />
        </label>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-foreground">הגדרות שובר</h2>
        <p className="text-sm leading-relaxed text-muted">
          ההגדרות קובעות את תוקף השובר, מימוש חלקי, השלמה בחנות ודרך המימוש. שדה ריק משתמש בברירת מחדל, והיא מוצגת למארח ולחנות.
        </p>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">דרך מימוש</span>
          <input
            value={voucherRedemptionMethod}
            onChange={(event) => setVoucherRedemptionMethod(event.target.value)}
            list="voucher-redemption-methods"
            className={fieldClass}
          />
          <datalist id="voucher-redemption-methods">
            <option value="בחנות" />
            <option value="באתר" />
            <option value="בחנות ובאתר" />
          </datalist>
          <span className="text-xs text-muted">
            אם השדה ריק: {VOUCHER_TERM_DEFAULTS.redemptionMethod}
          </span>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">תוקף בימים</span>
          <input
            value={voucherValidityDays}
            onChange={(event) => setVoucherValidityDays(event.target.value)}
            inputMode="numeric"
            dir="ltr"
            className={fieldClass}
          />
          <span className="text-xs text-muted">
            אם השדה ריק: {VOUCHER_TERM_DEFAULTS.validityDays} ימים
          </span>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">מימוש חלקי</span>
          <select
            value={allowPartialRedemption}
            onChange={(event) => setAllowPartialRedemption(event.target.value)}
            className={fieldClass}
          >
            <option value="">לא הוגדר</option>
            <option value="true">כן</option>
            <option value="false">לא</option>
          </select>
          <span className="text-xs text-muted">אם לא הוגדר: מימוש של כל היתרה בלבד</span>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">הלקוח יכול להשלים כסף בחנות</span>
          <select
            value={allowCustomerTopup}
            onChange={(event) => setAllowCustomerTopup(event.target.value)}
            className={fieldClass}
          >
            <option value="">לא הוגדר</option>
            <option value="true">כן</option>
            <option value="false">לא</option>
          </select>
          <span className="text-xs text-muted">אם לא הוגדר: אי אפשר להשלים סכום בחנות</span>
        </label>
      </section>

      {error ? <p className="text-sm text-brand">{error}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {saving ? "שומרים..." : "שמירה"}
      </button>
    </form>
  );
}
