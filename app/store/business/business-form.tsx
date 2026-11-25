"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none focus:border-brand";

type Fields = {
  name: string;
  websiteUrl: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

export default function BusinessForm({ store }: { store: Fields }) {
  const router = useRouter();
  const [name, setName] = useState(store.name);
  const [websiteUrl, setWebsiteUrl] = useState(store.websiteUrl ?? "");
  const [contactName, setContactName] = useState(store.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(store.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(store.contactEmail ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/store/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          websiteUrl,
          contactName,
          contactPhone,
          contactEmail,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error || "עדכון הפרטים נכשל.");
        return;
      }
      router.refresh();
    } catch {
      setError("עדכון הפרטים נכשל.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-semibold">
        שם העסק
        <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        איש קשר
        <input className={fieldClass} value={contactName} onChange={(event) => setContactName(event.target.value)} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        טלפון
        <input className={fieldClass} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        אימייל
        <input className={fieldClass} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        אתר
        <input className={fieldClass} value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} dir="ltr" />
      </label>
      {error ? <p className="text-sm text-brand">{error}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white disabled:opacity-60"
      >
        {saving ? "שומרים..." : "שמירת פרטי העסק"}
      </button>
    </form>
  );
}
