"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function NotesForm({
  subjectKind,
  subjectId,
}: {
  subjectKind: "order" | "event";
  subjectId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectKind, subjectId, body }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "שמירת ההערה נכשלה.");
        return;
      }
      setBody("");
      router.refresh();
    } catch {
      setError("שמירת ההערה נכשלה.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-2 text-sm font-semibold">
        הערה חדשה
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          rows={4}
          className="rounded-2xl border border-border bg-white px-4 py-3 text-base font-normal outline-none focus:border-brand"
        />
      </label>
      {error ? <p className="text-sm text-brand">{error}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-12 w-fit items-center justify-center rounded-full bg-brand px-6 font-semibold text-white disabled:opacity-60"
      >
        {saving ? "שומרים..." : "שמירת הערה"}
      </button>
    </form>
  );
}
