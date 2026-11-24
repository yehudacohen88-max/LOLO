"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/design/bold-host.module.css";
import { userFacingMessage } from "@/app/design/user-error";
import { absoluteAppUrl } from "@/lib/app-url";
import type { EventGuest } from "@/lib/host/guest-fields";
import { whatsappInviteUrl } from "@/lib/invite/whatsapp";
import LegalCollectionNotice from "@/components/legal/collection-notice";

type HostGuestListProps = {
  eventId: string;
  eventTitle: string;
  origin: string;
  guests: EventGuest[];
  disabled?: boolean;
  legalDrafts?: boolean;
};

export default function HostGuestList({
  eventId,
  eventTitle,
  origin,
  guests,
  disabled = false,
  legalDrafts = false,
}: HostGuestListProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<EventGuest[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  const visible = [
    ...guests.filter((guest) => !removed.includes(guest.id)),
    ...added.filter(
      (guest) => !guests.some((item) => item.id === guest.id) && !removed.includes(guest.id),
    ),
  ];

  function absoluteInviteUrl(invitePath: string) {
    const fallback =
      origin ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return absoluteAppUrl(invitePath, fallback);
  }

  async function copyInviteLink(invitePath: string) {
    const url = absoluteInviteUrl(invitePath);
    if (!url) {
      setError("קישור ההזמנה עדיין לא מוכן.");
      return;
    }
    await navigator.clipboard.writeText(url);
    setToast("הקישור האישי הועתק");
    window.setTimeout(() => setToast(""), 3000);
  }

  async function addGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const response = await fetch(`/api/host/events/${eventId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const payload = (await response.json()) as { error?: string; guest?: EventGuest };
      if (!response.ok) {
        throw new Error(payload.error || "הוספת האורח נכשלה.");
      }
      if (payload.guest?.id) {
        setAdded((current) => [...current, payload.guest as EventGuest]);
      }
      setName("");
      setPhone("");
      router.refresh();
    } catch (nextError) {
      setError(userFacingMessage(nextError, "הוספת האורח נכשלה. בדקו את החיבור ונסו שוב."));
    } finally {
      setSaving(false);
    }
  }

  async function removeGuest(guestId: string) {
    setError("");
    setSaving(true);

    try {
      const response = await fetch(
        `/api/host/events/${encodeURIComponent(eventId)}/guests/${encodeURIComponent(guestId)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "הסרת האורח נכשלה.");
      }
      setRemoved((current) => [...current, guestId]);
      router.refresh();
    } catch (nextError) {
      setError(userFacingMessage(nextError, "הסרת האורח נכשלה. בדקו את החיבור ונסו שוב."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card} id="host-guests" data-host-shot="guests">
      <h2>רשימת מוזמנים</h2>
      <p className={styles.help}>
        {visible.length === 0
          ? "אין מוזמנים ברשימה עדיין"
          : `${visible.length} מוזמנים`}
      </p>
      {toast ? (
        <p className={styles.toast} role="status">
          {toast}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <p>הוסיפו אורחים ידנית. זו רשימת ההזמנה, לא הזמנות תשלום.</p>
        </div>
      ) : (
        <ul className={styles.stack}>
          {visible.map((guest) => {
            const inviteUrl = absoluteInviteUrl(guest.invitePath ?? "");
            const waUrl = whatsappInviteUrl({
              phone: guest.phone,
              guestName: guest.name,
              eventTitle,
              inviteUrl,
            });

            return (
              <li key={guest.id} className={styles.guest}>
                <div>
                  <p className={styles.guestName} dir="auto">
                    {guest.name}
                  </p>
                  <p className={styles.phone} dir="ltr">
                    {guest.phone}
                  </p>
                </div>
                <div className={styles.guestActions}>
                  {guest.invitePath ? (
                    <>
                      <button
                        type="button"
                        disabled={saving || disabled}
                        onClick={() => copyInviteLink(guest.invitePath ?? "")}
                        className={styles.secondary}
                      >
                        העתק קישור אישי
                      </button>
                      {waUrl && !disabled ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.secondary}
                        >
                          שלח ב-WhatsApp
                        </a>
                      ) : null}
                      {waUrl && disabled ? (
                        <span className={styles.secondary}>שלח ב-WhatsApp</span>
                      ) : null}
                    </>
                  ) : (
                    <p className={styles.help}>
                      הקישור שנשלח עדיין תקף, אבל לא ניתן להציג אותו שוב.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={saving || disabled}
                    onClick={() => removeGuest(guest.id)}
                    className={styles.secondary}
                  >
                    הסרה
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <LegalCollectionNotice enabled={legalDrafts} kind="host" className={styles.help} />
      <form onSubmit={addGuest} className={styles.form}>
        <label className={styles.field}>
          <span>שם האורח</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            dir="auto"
            disabled={disabled}
            className={styles.input}
          />
        </label>
        <label className={styles.field}>
          <span>מספר טלפון</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={styles.input}
            dir="ltr"
            disabled={disabled}
          />
        </label>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={saving || disabled} className={styles.primary}>
          הוספת אורח
        </button>
      </form>
    </section>
  );
}
