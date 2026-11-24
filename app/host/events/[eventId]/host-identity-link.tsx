"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "@/app/design/bold-host.module.css";
import { userFacingMessage } from "@/app/design/user-error";
import type { HostRecoveryChannel } from "@/lib/host/dashboard";

export default function HostIdentityLink({
  eventId,
  channel,
}: {
  eventId: string;
  channel: HostRecoveryChannel;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  async function link(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch(`/api/host/events/${eventId}/identity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "קישור האירוע נכשל.");
      }
      setSaved("האירוע קושר לאימייל. אפשר לראות אותו ברשימה.");
      setEmail("");
      router.refresh();
    } catch (nextError) {
      setError(userFacingMessage(nextError, "קישור האירוע נכשל. בדקו את החיבור ונסו שוב."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card} id="host-identity">
      <h2>האירועים שלי</h2>
      {channel.state === "unavailable" ? (
        <p className={styles.help}>קישור האירועים לאימייל עדיין לא הופעל.</p>
      ) : null}
      {channel.state === "linked" ? (
        <p className={styles.help}>
          ערוץ השחזור: {channel.maskedEmail || "מקושר"}. הקוד עצמו לא נשמר באימייל.
        </p>
      ) : null}
      {channel.state === "open" || channel.state === "linked" ? (
        <form onSubmit={link} className={styles.form}>
          <label className={styles.field}>
            <span>אימייל לשחזור ולרשימה</span>
            <input
              className={styles.input}
              type="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <p className={styles.help}>
            הקישור נשמר רק אחרי כניסה עם קוד הניהול. האימייל לא מופיע לאורחים.
          </p>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className={styles.toast} role="status">
              {saved}
            </p>
          ) : null}
          <button type="submit" className={styles.primary} disabled={saving}>
            קישור האירוע
          </button>
        </form>
      ) : null}
      <p className={styles.help}>
        <Link href="/host/events">לרשימת האירועים שלי</Link>
      </p>
    </section>
  );
}
