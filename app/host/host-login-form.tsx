"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "@/app/design/bold-host.module.css";
import { userFacingMessage } from "@/app/design/user-error";

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
        throw new Error(payload.error || "קישור האירוע או קוד הניהול שגויים.");
      }

      router.push(`/host/events/${payload.eventId}`);
    } catch (nextError) {
      setError(
        userFacingMessage(nextError, "לא הצלחנו להתחבר. בדקו את החיבור ונסו שוב."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <label className={styles.field}>
        <span>קישור האירוע או כתובת עמוד האורחים</span>
        <input
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="event-ab12"
          dir="ltr"
          className={styles.input}
          autoComplete="off"
        />
      </label>
      <label className={styles.field}>
        <span>קוד ניהול פרטי</span>
        <input
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value)}
          placeholder="XXXX-XXXX"
          dir="ltr"
          autoComplete="off"
          className={styles.input}
        />
      </label>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={saving} className={styles.primary}>
        כניסה
      </button>
    </form>
  );
}
