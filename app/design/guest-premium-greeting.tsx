"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { guestPremiumSample, guestPreviewPaths } from "@/app/design/guest-premium-sample";
import { formatGiftAmount } from "@/lib/guest-draft";
import styles from "@/app/design/guest-premium.module.css";

const sample = guestPremiumSample;

function chosenAmount(raw: string | null) {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return sample.defaultAmount;
  }
  return Math.round(amount);
}

export default function GuestPremiumGreeting() {
  const params = useSearchParams();
  const amount = chosenAmount(params.get("amount"));
  const [text, setText] = useState<string>(sample.greeting);
  const next = `${guestPreviewPaths.payment}?amount=${amount}`;

  return (
    <>
      <ol className={styles.steps} aria-label="שלבי ההשתתפות">
        <li>מתנה</li>
        <li aria-current="step">ברכה</li>
        <li>פרטים</li>
        <li>תשלום</li>
      </ol>
      <h1 className={styles.flowTitle}>משאירים ברכה</h1>
      <p className={styles.lede}>כמה מילים חמות. אפשר גם להמשיך בלי.</p>
      <p className={styles.lede}>
        באתר החי השלב הבא הוא פרטי האורח: שם מלא, טלפון ואימייל. בהדמיה הזו ממשיכים ישר לתשלום הדגמה.
      </p>

      <div className={styles.flow}>
        <section className={styles.card}>
          <h2 className={styles.kickerLabel}>המתנה שלכם</h2>
          <p className={styles.line}>
            <span>{sample.giftName}</span>
            <b>{formatGiftAmount(amount)}</b>
          </p>
          <p className={styles.total}>
            <span>סה״כ</span>
            <span>{formatGiftAmount(amount)}</span>
          </p>
        </section>

        <div className={styles.prompts} role="group" aria-label="הצעות לברכה">
          {sample.prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className={`${styles.prompt} ${text === prompt ? styles.promptOn : ""}`}
              aria-pressed={text === prompt}
              onClick={() => setText(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        <label className={styles.field}>
          ברכה במילים שלכם (לא חובה)
          <textarea
            value={text}
            rows={5}
            placeholder="או כותבים כאן משהו אישי..."
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <div className={styles.actions}>
          <Link className={styles.cta} href={next}>
            ממשיכים · {formatGiftAmount(amount)}
          </Link>
          <Link className={styles.ghost} href={guestPreviewPaths.event}>
            חזרה לבחירת המתנות
          </Link>
        </div>
      </div>
    </>
  );
}
