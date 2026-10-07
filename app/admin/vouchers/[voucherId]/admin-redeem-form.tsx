"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatGiftAmount } from "@/lib/guest-draft";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base outline-none focus:border-brand";

type AdminRedeemFormProps = {
  voucherId: string;
  canRedeem: boolean;
  allowPartial: boolean;
  remainingAmount: number;
};

export default function AdminRedeemForm({
  voucherId,
  canRedeem,
  allowPartial,
  remainingAmount,
}: AdminRedeemFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(remainingAmount));
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function redeem() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/vouchers/${voucherId}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: allowPartial ? Number(amount) : null,
          reference,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "המימוש נכשל.");
      }
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "המימוש נכשל.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-white p-5">
      <h2 className="text-lg font-bold">מימוש מטעם בית העסק</h2>
      <p className="mt-2 text-sm text-muted">
        אם הקופה לא יכולה להיכנס, אפשר לממש את השובר מכאן. היתרה היא{" "}
        {formatGiftAmount(remainingAmount)}.
      </p>
      {canRedeem ? (
        <div className="mt-4 flex flex-col gap-3">
          {allowPartial ? (
            <label className="flex flex-col gap-2 text-sm font-semibold">
              סכום
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                dir="ltr"
                className={fieldClass}
              />
            </label>
          ) : (
            <p className="text-sm text-muted">המימוש יהיה על כל היתרה.</p>
          )}
          <label className="flex flex-col gap-2 text-sm font-semibold">
            אסמכתה, אם יש
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className={fieldClass}
            />
          </label>
          {error ? <p className="text-sm text-brand">{error}</p> : null}
          <button
            type="button"
            onClick={redeem}
            disabled={saving}
            className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white disabled:opacity-60"
          >
            {saving ? "מממשים..." : "מימוש"}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">אי אפשר לממש את השובר במצבו הנוכחי.</p>
      )}
    </section>
  );
}
