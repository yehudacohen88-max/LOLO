"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/design/bold-host.module.css";
import { userFacingMessage } from "@/app/design/user-error";
import type { HostEventSummary } from "@/lib/host/identity-public";

export default function MyEventsList({ events }: { events: HostEventSummary[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [opening, setOpening] = useState("");

  async function openEvent(eventId: string) {
    setOpening(eventId);
    setError("");
    try {
      const response = await fetch(`/api/host/events/${eventId}/session`, { method: "POST" });
      const payload = (await response.json()) as { error?: string; eventId?: string };
      if (!response.ok || !payload.eventId) {
        throw new Error(payload.error || "לא ניתן לפתוח את האירוע.");
      }
      router.push(`/host/events/${payload.eventId}`);
    } catch (nextError) {
      setError(userFacingMessage(nextError, "לא ניתן לפתוח את האירוע. בדקו את החיבור ונסו שוב."));
      setOpening("");
    }
  }

  if (events.length === 0) {
    return (
      <div className={styles.empty}>
        <p>אין אירועים מקושרים. היכנסו עם קוד הניהול וקשרו אימייל.</p>
      </div>
    );
  }

  return (
    <>
      <ul className={styles.stack}>
        {events.map((event) => (
          <li key={event.id} className={styles.order}>
            <p className={styles.orderName} dir="auto">
              {event.title || "אירוע"}
            </p>
            <p className={styles.help}>{event.date || "בלי תאריך"}</p>
            <p className={styles.help} dir="ltr">
              {event.slug}
            </p>
            <button
              type="button"
              className={styles.primary}
              disabled={opening === event.id}
              onClick={() => void openEvent(event.id)}
            >
              כניסה לניהול
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
