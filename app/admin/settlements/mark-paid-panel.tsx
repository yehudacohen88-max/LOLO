"use client";

import { SETTLEMENT_METHODS, settlementLabel, type SettlementMethod } from "@/lib/admin/store-fields";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MarkPaidPanel({
  settlementId,
  payableLabel,
  defaultMethod,
}: {
  settlementId: string;
  payableLabel: string;
  defaultMethod: SettlementMethod;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<SettlementMethod>(defaultMethod);
  const [reference, setReference] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function markPaid() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/settlements/${settlementId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, reference }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "סימון התשלום נכשל.");
      }
      setConfirming(false);
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "סימון התשלום נכשל.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-white p-5">
      <h2 className="text-lg font-bold">סימון כשולם</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        הסכום לתשלום לבית העסק הוא {payableLabel}. בגרסת ההדגמה התשלום מתועד כאן ואינו העברה בנקאית.
      </p>
      <label className="mt-4 flex flex-col gap-2 text-sm font-semibold">
        אופן התשלום
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value as SettlementMethod)}
          className="h-12 rounded-2xl border border-border bg-white px-4 font-normal"
        >
          {SETTLEMENT_METHODS.map((item) => (
            <option key={item} value={item}>
              {settlementLabel(item)}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 flex flex-col gap-2 text-sm font-semibold">
        אסמכתה (לא חובה)
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          maxLength={80}
          className="h-12 rounded-2xl border border-border bg-white px-4 font-normal"
          placeholder="לדוגמה מספר העברה"
        />
      </label>
      {error ? <p className="mt-3 text-sm text-brand">{error}</p> : null}
      {confirming ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={markPaid}
            disabled={saving}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-brand px-5 font-semibold text-white disabled:opacity-60"
          >
            {saving ? "מסמנים..." : "אישור סימון כשולם"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-border px-5 font-semibold"
          >
            חזרה
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
        >
          סימון כשולם
        </button>
      )}
    </section>
  );
}
