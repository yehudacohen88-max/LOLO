"use client";

import { useState, type FormEvent } from "react";
import { formatGiftAmount } from "@/lib/guest-draft";
import { calculateGuestFee, type GuestFeeSettings } from "@/lib/payments/fee";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

function choiceClass(selected: boolean) {
  return `flex h-12 flex-1 items-center justify-center rounded-2xl border-2 text-sm font-semibold ${
    selected
      ? "border-brand bg-brand-soft text-brand"
      : "border-border bg-white text-foreground"
  }`;
}

export default function FeeSettingsForm({ initial }: { initial: GuestFeeSettings }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [percent, setPercent] = useState(String(initial.percent));
  const [fixedAmount, setFixedAmount] = useState(String(initial.fixedAmount));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const percentValue = Number(percent);
  const fixedValue = Number(fixedAmount);
  const previewReady = Number.isFinite(percentValue) && Number.isFinite(fixedValue);
  const preview = previewReady
    ? calculateGuestFee(100, {
        enabled,
        percent: percentValue,
        fixedAmount: fixedValue,
      })
    : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestFeeEnabled: enabled,
          guestFeePercent: percentValue,
          guestFeeFixed: fixedValue,
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
    <form onSubmit={handleSubmit} className="mt-8 flex max-w-xl flex-col gap-5">
      <fieldset className="rounded-3xl border border-border bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-foreground">גביית עמלת שירות</legend>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            aria-pressed={!enabled}
            onClick={() => {
              setEnabled(false);
              setSaved(false);
            }}
            className={choiceClass(!enabled)}
          >
            כבויה
          </button>
          <button
            type="button"
            aria-pressed={enabled}
            onClick={() => {
              setEnabled(true);
              setSaved(false);
            }}
            className={choiceClass(enabled)}
          >
            פעילה
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          כשהגבייה כבויה, האורח משלם רק את ההשתתפות במתנה.
        </p>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">אחוז מההשתתפות</span>
        <input
          className={fieldClass}
          inputMode="decimal"
          value={percent}
          onChange={(event) => {
            setPercent(event.target.value);
            setSaved(false);
          }}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">סכום קבוע בשקלים</span>
        <input
          className={fieldClass}
          inputMode="decimal"
          value={fixedAmount}
          onChange={(event) => {
            setFixedAmount(event.target.value);
            setSaved(false);
          }}
        />
        <span className="text-sm leading-relaxed text-muted">
          אפשר להשתמש באחוז, בסכום קבוע, או בשניהם. שניהם מתווספים להשתתפות ואינם נספרים ליעד המתנה.
        </span>
      </label>

      <div className="rounded-3xl bg-brand-soft px-5 py-4 text-sm">
        <p className="font-semibold text-foreground">דוגמה לחישוב על השתתפות של 100 ₪</p>
        <p className="mt-1 text-muted">זו המחשה בלבד, לא תעריף קבוע.</p>
        {preview ? (
          <p className="mt-3 font-semibold text-foreground">
            {preview.feeAmount > 0
              ? `עמלת שירות ${formatGiftAmount(preview.feeAmount)} · סה״כ לחיוב ${formatGiftAmount(preview.chargedAmount)}`
              : "ללא עמלת שירות"}
          </p>
        ) : (
          <p className="mt-3 text-muted">הזינו אחוז וסכום תקינים כדי לראות דוגמה.</p>
        )}
      </div>

      {error ? <p className="text-sm text-brand">{error}</p> : null}
      {saved ? <p className="text-sm font-semibold text-brand">ההגדרות נשמרו</p> : null}

      <button
        type="submit"
        disabled={saving || !previewReady}
        className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover disabled:bg-brand/40"
      >
        {saving ? "שומרים..." : "שמירת הגדרות"}
      </button>
    </form>
  );
}
