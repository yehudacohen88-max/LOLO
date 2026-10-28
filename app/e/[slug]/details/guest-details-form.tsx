"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { guestEventPath } from "@/lib/events";
import { fromRouteParam } from "@/lib/events/slug";
import {
  formatGiftAmount,
  getContributionsTotal,
  isValidEmail,
  isValidPhone,
  loadContributions,
  loadGuestDetails,
  saveGuestDetails,
} from "@/lib/guest-draft";
import { savePendingGuestOrder } from "@/lib/orders/client";
import styles from "../flagship.module.css";

export default function GuestDetailsForm() {
  const router = useRouter();
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [wantReceipt, setWantReceipt] = useState(true);
  const [amountLine, setAmountLine] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
  }>({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!slug) {
        return;
      }

      const details = loadGuestDetails(slug);
      if (cancelled) {
        return;
      }

      let name = details.name;
      let phone = details.phone;
      if (!name || !phone) {
        try {
          const response = await fetch(
            `/api/invite/identity?slug=${encodeURIComponent(slug)}`,
          );
          if (response.ok) {
            const invite = (await response.json()) as {
              name?: string;
              phone?: string;
            };
            name = name || invite.name || "";
            phone = phone || invite.phone || "";
          }
        } catch {
          // Keep local draft values.
        }
      }

      if (cancelled) {
        return;
      }

      setName(name);
      setPhone(phone);
      setEmail(details.email);
      setWantReceipt(details.wantReceipt);
      const chosen = loadContributions(slug);
      const total = getContributionsTotal(chosen);
      setAmountLine(
        chosen.length > 0
          ? `${chosen.map((item) => item.giftName).join(" · ")} · ${formatGiftAmount(total)}`
          : "",
      );
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!ready) {
    return <p className={styles.quietLine}>טוענים את הפרטים...</p>;
  }

  return (
    <form
      className={styles.flowBody}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const nextErrors: typeof errors = {};

        if (!name.trim()) {
          nextErrors.name = "נא להזין שם מלא";
        }
        if (!isValidPhone(phone)) {
          nextErrors.phone = "נא להזין מספר טלפון תקין";
        }
        if (!isValidEmail(email)) {
          nextErrors.email = "נא להזין כתובת אימייל תקינה";
        }

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
          return;
        }

        if (getContributionsTotal(loadContributions(slug)) <= 0) {
          setSaveError("עדיין לא נבחרה מתנה.");
          return;
        }

        saveGuestDetails(slug, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          wantReceipt,
        });

        try {
          setSaving(true);
          setSaveError("");
          await savePendingGuestOrder(slug);
          router.push(guestEventPath(slug, "payment"));
        } catch (error) {
          setSaveError(
            error instanceof Error ? error.message : "שמירת ההזמנה נכשלה.",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      {amountLine ? <p className={`${styles.quietLine} ${styles.detailsChoice}`}>{amountLine}</p> : null}
      <label className={styles.stack}>
        <span>שם מלא</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "guest-name-error" : undefined}
        />
        {errors.name ? (
          <span id="guest-name-error" className={styles.fieldError}>
            {errors.name}
          </span>
        ) : null}
      </label>
      <label className={styles.stack}>
        <span>מספר טלפון</span>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="tel"
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? "guest-phone-error" : undefined}
        />
        {errors.phone ? (
          <span id="guest-phone-error" className={styles.fieldError}>
            {errors.phone}
          </span>
        ) : null}
      </label>
      <label className={styles.stack}>
        <span>אימייל</span>
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "guest-email-error" : undefined}
        />
        {errors.email ? (
          <span id="guest-email-error" className={styles.fieldError}>
            {errors.email}
          </span>
        ) : null}
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={wantReceipt}
          onChange={(event) => setWantReceipt(event.target.checked)}
        />
        <span>אני רוצה לקבל אישור על המתנה</span>
      </label>
      {saveError ? <p className={styles.fieldError}>{saveError}</p> : null}
      <button type="submit" disabled={saving} className={styles.cta}>
        מעבר לתשלום
      </button>
    </form>
  );
}
