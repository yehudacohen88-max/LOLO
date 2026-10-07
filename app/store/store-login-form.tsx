"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

export default function StoreLoginForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/store/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, accessCode }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "שם הכניסה או קוד הכניסה שגויים.");
      }
      router.push("/store/redeem");
      router.refresh();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "שם הכניסה או קוד הכניסה שגויים.",
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">שם הכניסה של החנות</span>
        <input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          dir="ltr"
          autoComplete="off"
          placeholder="bike-shop"
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">קוד כניסה</span>
        <input
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value)}
          dir="ltr"
          autoComplete="off"
          placeholder="XXXX-XXXX-XXXX"
          className={fieldClass}
        />
      </label>
      {error ? <p className="text-center text-sm text-brand">{error}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
      >
        {saving ? "נכנסים..." : "כניסה"}
      </button>
    </form>
  );
}
