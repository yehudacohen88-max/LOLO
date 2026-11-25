"use client";

import { useState, type FormEvent } from "react";
import { SETTLEMENT_ROUNDING_RULE } from "@/lib/settlements/rounding";
import type { SettlementPolicy } from "@/lib/settlements/policy";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

export default function SettlementSettingsForm({ initial }: { initial: SettlementPolicy }) {
  const [percent, setPercent] = useState(
    initial.fallbackCommissionPercent == null ? "" : String(initial.fallbackCommissionPercent),
  );
  const [days, setDays] = useState(
    initial.fallbackPaymentTermsDays == null ? "" : String(initial.fallbackPaymentTermsDays),
  );
  const [rounding, setRounding] = useState(initial.rounding ?? "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings/settlement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCommissionPercent: percent,
          defaultPaymentTermsDays: days,
          moneyRounding: rounding,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "שמירת ההגדרות נכשלה.");
      }
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "שמירת ההגדרות נכשלה.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex max-w-xl flex-col gap-5">
      <h2 className="text-lg font-bold">התחשבנות מול בתי עסק</h2>
      <p className="text-sm leading-relaxed text-muted">
        אחוז העמלה וימי התשלום נשמרים על כל מימוש. השדות כאן הם ברירת מחדל רק כשאין ערך שמור.
        שדה ריק אינו 0. בלי ערך שמור ובלי ברירת מחדל אי אפשר ליצור התחשבנות.
      </p>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">ברירת מחדל לאחוז עמלה</span>
        <input
          className={fieldClass}
          inputMode="decimal"
          value={percent}
          placeholder="ריק = סירוב"
          onChange={(event) => {
            setPercent(event.target.value);
            setSaved(false);
          }}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">ברירת מחדל לימי תשלום</span>
        <input
          className={fieldClass}
          inputMode="numeric"
          value={days}
          placeholder="ריק = סירוב"
          onChange={(event) => {
            setDays(event.target.value);
            setSaved(false);
          }}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">כלל עיגול</span>
        <select
          className={fieldClass}
          value={rounding}
          onChange={(event) => {
            setRounding(event.target.value);
            setSaved(false);
          }}
        >
          <option value="">לא נבחר</option>
          <option value={SETTLEMENT_ROUNDING_RULE}>חצי הרחק מאפס</option>
        </select>
        <span className="text-sm leading-relaxed text-muted">
          אותו כלל משמש את החישוב במערכת ובמסד. בלי בחירה אי אפשר ליצור התחשבנות.
        </span>
      </label>
      {error ? <p className="text-sm text-brand">{error}</p> : null}
      {saved ? <p className="text-sm font-semibold text-brand">הגדרות ההתחשבנות נשמרו</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover disabled:bg-brand/40"
      >
        {saving ? "שומרים..." : "שמירת הגדרות התחשבנות"}
      </button>
    </form>
  );
}
