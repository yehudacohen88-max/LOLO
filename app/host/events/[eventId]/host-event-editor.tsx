"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/design/bold-host.module.css";
import { userFacingMessage } from "@/app/design/user-error";
import type { HostDashboardData, HostDashboardGift } from "@/lib/host/dashboard";

type DraftGift = {
  key: string;
  id: string;
  title: string;
  description: string;
  targetAmount: string;
  storeId: string;
  active: boolean;
  funded: boolean;
  ordered: boolean;
  vouchered: boolean;
};

function draftFromGift(gift: HostDashboardGift): DraftGift {
  const vouchered = gift.vouchers.some((voucher) => voucher.status !== "CANCELLED");
  return {
    key: gift.id,
    id: gift.id,
    title: gift.title,
    description: gift.description,
    targetAmount: gift.targetAmount == null ? "" : String(gift.targetAmount),
    storeId: gift.storeId ?? "",
    active: true,
    funded: gift.paidAmount > 0,
    ordered: gift.paidAmount > 0 || gift.pendingAmount > 0,
    vouchered,
  };
}

export default function HostEventEditor({ data }: { data: HostDashboardData }) {
  const router = useRouter();
  const greetingEnabled = data.invitationGreeting != null;
  const [title, setTitle] = useState(data.title);
  const [hostName, setHostName] = useState(data.hostName);
  const [eventType, setEventType] = useState(data.eventType);
  const [date, setDate] = useState(data.eventDate);
  const [time, setTime] = useState(data.eventTime);
  const [venueName, setVenueName] = useState(data.venueName);
  const [address, setAddress] = useState(data.address);
  const [message, setMessage] = useState(data.message);
  const [greeting, setGreeting] = useState(data.invitationGreeting ?? "");
  const [gifts, setGifts] = useState<DraftGift[]>(() => data.gifts.map(draftFromGift));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  function updateGift(key: string, patch: Partial<DraftGift>) {
    setGifts((current) => current.map((gift) => (gift.key === key ? { ...gift, ...patch } : gift)));
  }

  function moveGift(key: string, direction: -1 | 1) {
    setGifts((current) => {
      const index = current.findIndex((gift) => gift.key === key);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.length) {
        return current;
      }
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const body: Record<string, unknown> = {
        title,
        hostName,
        eventType,
        date,
        time,
        venueName,
        address,
        message,
        gifts: gifts.map((gift) => ({
          id: gift.id,
          title: gift.title,
          description: gift.description,
          targetAmount: gift.targetAmount === "" ? 0 : Number(gift.targetAmount),
          storeId: gift.storeId || null,
          active: gift.active,
        })),
      };
      if (greetingEnabled) {
        body.invitationGreeting = greeting;
      }
      const response = await fetch(`/api/host/events/${data.eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "שמירת האירוע נכשלה.");
      }
      setSaved("האירוע עודכן. קישור האורחים לא השתנה.");
      router.refresh();
    } catch (nextError) {
      setError(userFacingMessage(nextError, "שמירת האירוע נכשלה. בדקו את החיבור ונסו שוב."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card} id="host-edit">
      <h2>עריכת האירוע</h2>
      <p className={styles.help}>
        הקישור לאורחים נשאר אותו קישור. תמונת הנושא ותמונות המתנות מתעדכנות בסקירה. מתנה שכבר יש עליה
        הזמנה או שובר לא נמחקת.
      </p>
      <form onSubmit={save} className={styles.form}>
        <label className={styles.field}>
          <span>שם האירוע</span>
          <input className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>שם המארח</span>
          <input className={styles.input} value={hostName} onChange={(event) => setHostName(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>סוג האירוע</span>
          <input className={styles.input} value={eventType} onChange={(event) => setEventType(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>תאריך</span>
          <input className={styles.input} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>שעה</span>
          <input className={styles.input} type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>מקום</span>
          <input className={styles.input} value={venueName} onChange={(event) => setVenueName(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>כתובת</span>
          <input className={styles.input} value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>הודעה לאורחים</span>
          <textarea className={`${styles.input} ${styles.textarea}`} value={message} onChange={(event) => setMessage(event.target.value)} />
        </label>
        {greetingEnabled ? (
          <label className={styles.field}>
            <span>ברכת ההזמנה</span>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              value={greeting}
              onChange={(event) => setGreeting(event.target.value)}
            />
            <span className={styles.help}>אפשר לכתוב {"{name}"} ו-{"{event}"}. הקישור האישי נוסף אם הוא חסר.</span>
          </label>
        ) : (
          <p className={styles.help}>שמירת ברכת ההזמנה עדיין לא הופעלה.</p>
        )}

        <h3>מתנות וחנויות</h3>
        {gifts.map((gift, index) => (
          <fieldset key={gift.key} className={styles.field}>
            <label className={styles.field}>
              <span>שם המתנה</span>
              <input className={styles.input} value={gift.title} onChange={(event) => updateGift(gift.key, { title: event.target.value })} />
            </label>
            <label className={styles.field}>
              <span>תיאור</span>
              <input className={styles.input} value={gift.description} onChange={(event) => updateGift(gift.key, { description: event.target.value })} />
            </label>
            <label className={styles.field}>
              <span>יעד</span>
              <input
                className={styles.input}
                inputMode="decimal"
                value={gift.targetAmount}
                disabled={gift.funded}
                onChange={(event) => updateGift(gift.key, { targetAmount: event.target.value })}
              />
            </label>
            {gift.funded ? <p className={styles.help}>היעד נעול כי כבר שולם למתנה.</p> : null}
            <label className={styles.field}>
              <span>חנות</span>
              <select
                className={styles.input}
                value={gift.storeId}
                disabled={gift.vouchered}
                onChange={(event) => updateGift(gift.key, { storeId: event.target.value })}
              >
                <option value="">בלי חנות קבועה</option>
                {data.voucherStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
                {gift.storeId && !data.voucherStores.some((store) => store.id === gift.storeId) ? (
                  <option value={gift.storeId}>חנות שמורה</option>
                ) : null}
              </select>
            </label>
            {gift.vouchered ? <p className={styles.help}>החנות נעולה כי כבר הונפק שובר.</p> : null}
            <div className={styles.guestActions}>
              <button type="button" className={styles.secondary} disabled={index === 0} onClick={() => moveGift(gift.key, -1)}>
                למעלה
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={index === gifts.length - 1}
                onClick={() => moveGift(gift.key, 1)}
              >
                למטה
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={gift.ordered || gift.vouchered}
                onClick={() => setGifts((current) => current.filter((item) => item.key !== gift.key))}
              >
                הסרה
              </button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          className={styles.secondary}
          onClick={() =>
            setGifts((current) => [
              ...current,
              {
                key: `new-${current.length}-${Date.now()}`,
                id: "",
                title: "",
                description: "",
                targetAmount: "",
                storeId: "",
                active: true,
                funded: false,
                ordered: false,
                vouchered: false,
              },
            ])
          }
        >
          הוספת מתנה
        </button>
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
          שמירת שינויים
        </button>
      </form>
    </section>
  );
}
