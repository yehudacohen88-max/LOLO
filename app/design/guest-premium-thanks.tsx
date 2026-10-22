"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BETA_CLARITY } from "@/app/design/beta-notice";
import { guestPremiumSample, guestPreviewPaths } from "@/app/design/guest-premium-sample";
import { formatGiftAmount } from "@/lib/guest-draft";
import styles from "@/app/design/guest-premium.module.css";

const sample = guestPremiumSample;
const exampleUrl = "https://lolo.example/e/demo-event";

export default function GuestPremiumThanks() {
  const [shareNote, setShareNote] = useState("");
  const shareText = `בואו לחגוג: ${sample.title}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(exampleUrl);
      setShareNote("הקישור הועתק");
    } catch {
      setShareNote(exampleUrl);
    }
  }

  return (
    <>
      <h1 className={styles.flowTitle}>תודה</h1>
      <p className={styles.lede}>ההשתתפות שלכם כבר חלק מהמתנה.</p>

      <div className={styles.flow}>
        <div className={`${styles.card} ${styles.thanksHero}`}>
          <div className={styles.celebrant}>
            <Image src={sample.coverSrc} alt="" width={88} height={112} />
            <div>
              <p className={styles.kickerLabel}>חוגגים יחד</p>
              <p className={styles.thanksName}>{sample.title}</p>
            </div>
          </div>
          <div className={styles.aside}>
            <Image src={sample.giftImage} alt={sample.giftImageAlt} width={92} height={92} />
            <div>
              <p className={styles.giftName}>{sample.giftName}</p>
              <p>מאת {sample.guestName}</p>
              <p>כבר {sample.contributorCount} חברים הצטרפו</p>
            </div>
          </div>
        </div>

        <section className={styles.card}>
          <p className={styles.demo}>
            <strong>תשלום הדגמה — לא מתבצע חיוב אמיתי</strong>
            {BETA_CLARITY}
          </p>
          <p className={styles.status} role="status">
            שולם בהדגמה
          </p>
          <p className={styles.line}>
            <span>{sample.giftName}</span>
            <b>{formatGiftAmount(sample.defaultAmount)}</b>
          </p>
          <p className={styles.line}>
            <span>השתתפות במתנה</span>
            <b>{formatGiftAmount(sample.defaultAmount)}</b>
          </p>
          <p className={styles.line}>
            <span>ללא עמלת שירות</span>
          </p>
          <p className={styles.total}>
            <span>סכום בהדגמה</span>
            <span>{formatGiftAmount(sample.defaultAmount)}</span>
          </p>
          <p className={styles.muted}>ההשתתפות נוספה למתנה. תודה שחגגתם יחד.</p>
          <p className={styles.muted}>לא הונפק שובר, ולא מתבצע מימוש.</p>
        </section>

        <div className={styles.share}>
          <button type="button" className={styles.cta} onClick={() => setShareNote("שיתוף זמין בדפדפן שתומך בזה.")}>
            שיתוף האירוע
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${exampleUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            וואטסאפ
          </a>
          <button type="button" onClick={() => void copyLink()}>
            העתקת קישור
          </button>
        </div>
        {shareNote ? (
          <p className={styles.status} role="status">
            {shareNote}
          </p>
        ) : null}
        <Link className={styles.ghost} href={guestPreviewPaths.event}>
          חזרה לאירוע
        </Link>
      </div>
    </>
  );
}
