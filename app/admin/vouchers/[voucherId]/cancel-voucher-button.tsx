"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelVoucherButton({ voucherId }: { voucherId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function cancel() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/vouchers/${voucherId}/cancel`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "ביטול השובר נכשל.");
      }
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "ביטול השובר נכשל.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-white p-5">
      <h2 className="text-lg font-bold">ביטול שובר</h2>
      <p className="mt-2 text-sm text-muted">
        ביטול משחרר את הסכום להנפקה מחדש, רק אם עדיין לא היה מימוש.
      </p>
      {error ? <p className="mt-3 text-sm text-brand">{error}</p> : null}
      {confirming ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-brand px-5 font-semibold text-white disabled:opacity-60"
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
          className="mt-4 inline-flex h-12 items-center justify-center rounded-full border border-brand px-6 font-semibold text-brand"
        >
          ביטול השובר
        </button>
      )}
    </section>
  );
}
