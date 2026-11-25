"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "@/app/design/bold-host.module.css";
import { userFacingMessage } from "@/app/design/user-error";

export default function RecoveryForm() {
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [started, setStarted] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setAccessCode("");
    try {
      const response = await fetch("/api/host/recovery/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, email }),
      });
      const payload = (await response.json()) as { error?: string; accepted?: boolean };
      if (!response.ok) {
        throw new Error(payload.error || "לא ניתן להתחיל שחזור.");
      }
      setStarted(true);
    } catch (nextError) {
      setError(userFacingMessage(nextError, "לא ניתן להתחיל שחזור. בדקו את החיבור ונסו שוב."));
    } finally {
      setSaving(false);
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/host/recovery/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, email, otp }),
      });
      const payload = (await response.json()) as { error?: string; accessCode?: string };
      if (!response.ok || !payload.accessCode) {
        throw new Error(payload.error || "הפרטים אינם תואמים.");
      }
      setAccessCode(payload.accessCode);
      setOtp("");
    } catch (nextError) {
      setError(userFacingMessage(nextError, "הפרטים אינם תואמים."));
    } finally {
      setSaving(false);
    }
  }

  if (accessCode) {
    return (
      <div className={styles.form}>
        <p className={styles.help} role="status">
          הונפק קוד ניהול חדש. הוא מוצג פעם אחת כאן, לא נשמר בדפדפן, ולא נשלח בהודעה. הקוד הקודם כבר לא
          עובד.
        </p>
        <p className={styles.orderName} dir="ltr" data-new-access-code="">
          {accessCode}
        </p>
        <Link href="/host" className={styles.primary}>
          כניסה עם הקוד החדש
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <form onSubmit={start} className={styles.form}>
        <label className={styles.field}>
          <span>קישור האירוע</span>
          <input className={styles.input} dir="ltr" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="off" />
        </label>
        <label className={styles.field}>
          <span>אימייל השחזור</span>
          <input className={styles.input} dir="ltr" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </label>
        <button type="submit" className={styles.primary} disabled={saving}>
          בקשת קוד חד-פעמי
        </button>
      </form>
      {started ? (
        <>
          <p className={styles.help} role="status">
            אם הפרטים תואמים, נרשם קוד חד-פעמי אצל ספק ההודעות המדומה. ההודעה לא נשלחת ולא מוצגת כאן. קוד
            הניהול לא נשלח.
          </p>
          <form onSubmit={confirm} className={styles.form}>
            <label className={styles.field}>
              <span>קוד חד-פעמי</span>
              <input
                className={styles.input}
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
              />
            </label>
            <button type="submit" className={styles.secondary} disabled={saving}>
              אימות והנפקת קוד חדש
            </button>
          </form>
        </>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
