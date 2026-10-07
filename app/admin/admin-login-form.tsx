"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

export default function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "קוד הניהול שגוי.");
      }
      setPassword("");
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "קוד הניהול שגוי.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">קוד ניהול</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          dir="ltr"
          className={fieldClass}
        />
      </label>
      {error ? <p className="text-center text-sm text-brand">{error}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {saving ? "נכנסים..." : "כניסה"}
      </button>
    </form>
  );
}
