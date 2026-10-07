"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelSettlementButton({ settlementId }: { settlementId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/settlements/${settlementId}/cancel`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "ביטול ההתחשבנות נכשל.");
      }
      setConfirming(false);
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "ביטול ההתחשבנות נכשל.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-white p-5">
      <h2 className="text-lg font-bold">ביטול התחשבנות</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        הביטול משחרר את המימושים, ואפשר לכלול אותם בהתחשבנות חדשה. התחשבנות ששולמה לא ניתנת לביטול.
      </p>
      {error ? <p className="mt-3 text-sm text-brand">{error}</p> : null}
      {confirming ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-brand px-5 font-semibold text-brand disabled:opacity-60"
          >
            {saving ? "מבטלים..." : "אישור ביטול"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-border px-5 font-semibold"
          >
            השארה
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 inline-flex h-12 items-center justify-center rounded-full border border-border px-6 font-semibold"
        >
          ביטול ההתחשבנות
        </button>
      )}
    </section>
  );
}
