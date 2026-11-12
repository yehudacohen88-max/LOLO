"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { guestPremiumSample, guestPreviewPaths } from "@/app/design/guest-premium-sample";
import { isValidEmail, isValidPhone } from "@/lib/guest-draft";
import styles from "@/app/design/guest-premium.module.css";

const sample = guestPremiumSample;

function chosenAmount(raw: string | null) {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return sample.defaultAmount;
  }
  return Math.round(amount);
}

export default function GuestPremiumDetails() {
  const router = useRouter();
  const params = useSearchParams();
  const amount = chosenAmount(params.get("amount"));
  const [name, setName] = useState<string>(sample.guestName);
  const [phone, setPhone] = useState<string>(sample.guestPhone);
  const [email, setEmail] = useState<string>(sample.guestEmail);
  const [wantReceipt, setWantReceipt] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  function continueToPayment() {
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
    router.push(`${guestPreviewPaths.payment}?amount=${amount}`);
  }

  return (
    <>
      <ol className={styles.steps} aria-label="שלבי ההשתתפות">
        <li>מתנה</li>
        <li>ברכה</li>
        <li aria-current="step">פרטים</li>
        <li>תשלום</li>
      </ol>
      <p className={styles.example}>דוגמה</p>
      <h1 className={styles.flowTitle}>עוד רגע מסיימים</h1>
      <p className={styles.lede}>נשמח לדעת ממי המתנה.</p>
      <p className={styles.lede}>השדות מלאים בנתוני דוגמה. ההמשך נשאר בהדמיה ולא נשמר.</p>

      <form
        className={styles.flow}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          continueToPayment();
        }}
      >
        <label className={styles.field}>
          שם מלא
          <input
            value={name}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
          {errors.name ? <span className={styles.fieldError}>{errors.name}</span> : null}
        </label>
        <label className={styles.field}>
          מספר טלפון
          <input
            type="tel"
            value={phone}
            autoComplete="tel"
            onChange={(event) => setPhone(event.target.value)}
          />
          {errors.phone ? <span className={styles.fieldError}>{errors.phone}</span> : null}
        </label>
        <label className={styles.field}>
          אימייל
          <input
            type="email"
            value={email}
            autoComplete="email"
            dir="ltr"
            onChange={(event) => setEmail(event.target.value)}
          />
          {errors.email ? <span className={styles.fieldError}>{errors.email}</span> : null}
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={wantReceipt}
            onChange={(event) => setWantReceipt(event.target.checked)}
          />
          <span>אני רוצה לקבל אישור על המתנה</span>
        </label>
        <div className={styles.actions}>
          <button type="submit" className={styles.cta}>
            מעבר לתשלום
          </button>
          <Link className={styles.ghost} href={`${guestPreviewPaths.greeting}?amount=${amount}`}>
            חזרה לברכה
          </Link>
        </div>
      </form>
    </>
  );
}
