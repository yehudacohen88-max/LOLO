"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BETA_CLARITY } from "@/app/design/beta-notice";
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

export default function GuestPremiumPayment() {
  const params = useSearchParams();
  const amount = chosenAmount(params.get("amount"));
  const [failed, setFailed] = useState(false);

  return (
    <>
      <ol className={styles.steps} aria-label="שלבי ההשתתפות">
        <li>מתנה</li>
        <li>ברכה</li>
        <li>פרטים</li>
        <li aria-current="step">תשלום</li>
      </ol>
      <h1 className={styles.flowTitle}>תשלום</h1>
      <p className={styles.lede}>גרסת בטא — תשלומים מדומים בלבד</p>

      <div className={`${styles.flow} ${styles.payLayout}`}>
        <aside className={`${styles.card} ${styles.aside}`}>
          <Image src={sample.giftImage} alt="" width={92} height={92} />
          <div>
            <p className={styles.kickerLabel}>{sample.title}</p>
            <p className={styles.giftName}>{sample.giftName}</p>
            <p>כבר {sample.contributorCount} חברים הצטרפו</p>
          </div>
        </aside>

        <section className={styles.card} aria-busy={false}>
          <h2 className={styles.kickerLabel}>סיכום התשלום</h2>
          <p className={styles.amountLead}>{formatGiftAmount(amount)}</p>
          <p className={styles.demo}>
            <strong>תשלום הדגמה — לא מתבצע חיוב אמיתי</strong>
            {BETA_CLARITY}
          </p>
          <p className={styles.line}>{sample.title}</p>
          <p className={styles.muted}>{sample.guestName}</p>
          <p className={styles.muted}>״{sample.greeting}״</p>
          <p className={styles.line}>
            <span>{sample.giftName}</span>
            <b>{formatGiftAmount(amount)}</b>
          </p>
          <p className={styles.line}>
            <span>השתתפות במתנה</span>
            <b>{formatGiftAmount(amount)}</b>
          </p>
          <p className={styles.line}>
            <span>ללא עמלת שירות</span>
          </p>
          <p className={styles.total}>
            <span>סה״כ לחיוב</span>
            <span>{formatGiftAmount(amount)}</span>
          </p>
          <p className={styles.muted}>לא נגבה כסף אמיתי, ולא מתבקש מספר כרטיס אשראי.</p>

          {failed ? (
            <p className={styles.hint} role="alert">
              התשלום לא הושלם. אפשר לנסות שוב. לא בוצע חיוב.
            </p>
          ) : null}

          <div className={styles.actions}>
            <Link className={styles.cta} href={guestPreviewPaths.thanks}>
              אישור תשלום הדגמה
            </Link>
            <button type="button" className={styles.ghost} onClick={() => setFailed(true)}>
              הדמיית תשלום שנכשל
            </button>
          </div>
          <p className={styles.muted}>לבדיקה בלבד. לא מתבצע חיוב אמיתי.</p>
        </section>
      </div>
    </>
  );
}
