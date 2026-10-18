"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { absoluteAppUrl } from "@/lib/app-url";
import type { EventGuest } from "@/lib/host/guest-fields";
import { whatsappInviteUrl } from "@/lib/invite/whatsapp";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

type HostGuestListProps = {
  eventId: string;
  eventTitle: string;
  origin: string;
  guests: EventGuest[];
};

export default function HostGuestList({
  eventId,
  eventTitle,
  origin,
  guests,
}: HostGuestListProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

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
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "הוספת האורח נכשלה.");
      }
      setName("");
      setPhone("");
      router.refresh();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "הוספת האורח נכשלה.",
      );
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
      router.refresh();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "הסרת האורח נכשלה.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="guests" className="lolo-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans text-base font-bold text-foreground lg:text-lg">רשימת מוזמנים</h2>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-brand lg:hidden"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "סגירה" : "פתיחה"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        {guests.length === 0
          ? "אין מוזמנים ברשימה עדיין"
          : `${guests.length} מוזמנים`}
      </p>
      <div className={open ? "mt-3" : "mt-3 max-lg:hidden"}>
      {toast ? (
        <p className="mt-3 rounded-2xl bg-brand-soft px-4 py-3 text-center text-sm font-medium text-brand">
          {toast}
        </p>
      ) : null}

      {guests.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          הוסיפו אורחים ידנית. זו רשימת ההזמנה, לא הזמנות תשלום.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {guests.map((guest) => {
            const inviteUrl = absoluteInviteUrl(guest.invitePath ?? "");
            const waUrl = whatsappInviteUrl({
              phone: guest.phone,
              guestName: guest.name,
              eventTitle,
              inviteUrl,
            });

            return (
              <li
                key={guest.id}
                className="flex flex-col gap-3 rounded-2xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{guest.name}</p>
                  <p className="mt-0.5 text-sm text-muted" dir="ltr">
                    {guest.phone}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {guest.invitePath ? (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => copyInviteLink(guest.invitePath ?? "")}
                        className="text-sm font-semibold text-foreground disabled:text-muted"
                      >
                        העתק קישור אישי
                      </button>
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-brand"
                        >
                          שלח ב-WhatsApp
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted">
                      הקישור שנשלח עדיין תקף, אבל לא ניתן להציג אותו שוב.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => removeGuest(guest.id)}
                    className="text-sm font-semibold text-brand disabled:text-muted"
                  >
                    הסרה
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={addGuest} className="mt-5 flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">שם האורח</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">מספר טלפון</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={fieldClass}
            dir="ltr"
          />
        </label>
        {error ? <p className="text-center text-sm text-brand">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand/40"
        >
          הוספת אורח
        </button>
      </form>
      </div>
    </section>
  );
}
