"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

export default function HostLoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/host/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, accessCode }),
      });
      const payload = (await response.json()) as {
        eventId?: string;
        error?: string;
      };

      if (!response.ok || !payload.eventId) {
        throw new Error(payload.error || "מזהה האירוע או קוד הניהול שגויים.");
      }

      router.push(`/host/events/${payload.eventId}`);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "מזהה האירוע או קוד הניהול שגויים.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">
          מזהה האירוע או קישור האורחים
        </span>
        <input
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="event-ab12"
          dir="ltr"
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">
          קוד ניהול פרטי
        </span>
        <input
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value)}
          placeholder="XXXX-XXXX"
          dir="ltr"
          autoComplete="off"
          className={fieldClass}
        />
      </label>
      {error ? (
        <p className="text-center text-sm text-brand">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand/40"
      >
        כניסה
      </button>
    </form>
  );
}
