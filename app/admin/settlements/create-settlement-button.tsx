"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function CreateSettlementButton({
  storeId,
  disabled,
}: {
  storeId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID();
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, idempotencyKey: idempotencyKey.current }),
      });
      const payload = (await response.json()) as { error?: string; id?: string };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "יצירת ההתחשבנות נכשלה.");
      }
      router.push(`/admin/settlements/${payload.id}`);
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "יצירת ההתחשבנות נכשלה.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-sm text-brand">{error}</p> : null}
      <button
        type="button"
        onClick={create}
        disabled={disabled || saving}
        className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "יוצרים..." : "יצירת התחשבנות"}
      </button>
    </div>
  );
}
