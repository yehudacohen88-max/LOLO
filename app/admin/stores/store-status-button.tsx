"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StoreStatusButton({
  storeId,
  active,
}: {
  storeId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/stores/${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "עדכון הסטטוס נכשל.");
      }
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "עדכון הסטטוס נכשל.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground disabled:opacity-60"
      >
        {active ? "השבתה" : "הפעלה"}
      </button>
      {error ? <span className="text-xs text-brand">{error}</span> : null}
    </div>
  );
}
