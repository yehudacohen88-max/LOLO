"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BETA_CLARITY } from "@/app/design/beta-notice";
import { guestPremiumSample, guestPreviewPaths } from "@/app/design/guest-premium-sample";
import { formatGiftAmount } from "@/lib/guest-draft";
import styles from "@/app/design/guest-premium.module.css";

const sample = guestPremiumSample;

function parseAmount(value: string) {
  const amount = Number(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return Math.round(amount);
}

export default function GuestPremiumEvent() {
  const [amount, setAmount] = useState<number>(sample.defaultAmount);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [hint, setHint] = useState(false);
  const suggested = (sample.amounts as readonly number[]).includes(amount);
  const customSelected = customOpen && !suggested;
  const mapQuery = encodeURIComponent(sample.address);
  const greetingHref = `${guestPreviewPaths.greeting}?amount=${amount}`;

  return (
    <div className={styles.layout}>
      <div>
        <p className={styles.example}>דוגמה</p>
        <p className={styles.kickerLabel}>{sample.badge}</p>
        <Image
          className={styles.cover}
          src={sample.coverSrc}
          alt={sample.coverAlt}
          width={960}
          height={720}
          sizes="(min-width: 1100px) 640px, 100vw"
          style={{ width: "100%", height: "auto" }}
        />
        <p className={styles.credit}>{sample.credit}</p>
        <p className={styles.kicker}>
          <span>{sample.eventType}</span>
          <span className={styles.dot} aria-hidden="true" />
          <span>{sample.dateLabel}</span>
          <span className={styles.dot} aria-hidden="true" />
          <span>{sample.timeLabel}</span>
        </p>
        <h1 className={styles.title}>{sample.title}</h1>
        <p className={styles.sub}>מתנה מכל החברים</p>

        <div className={styles.stack}>
          <blockquote className={`${styles.card} ${styles.invite}`}>
            <p className={styles.kickerLabel}>הזמנה אישית מאת {sample.hostName}</p>
            <p className={styles.quote}>״{sample.message}״</p>
          </blockquote>

          <section className={styles.card} aria-label="מקום האירוע">
            <p className={styles.kickerLabel}>איפה חוגגים</p>
            <p className={styles.venueName}>{sample.venueName}</p>
            <p className={styles.address}>{sample.address}</p>
            <div className={styles.mapRow}>
              <a href={`https://waze.com/ul?q=${mapQuery}&navigate=yes`} target="_blank" rel="noopener noreferrer">
                Waze
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Maps
              </a>
            </div>
          </section>
        </div>
      </div>

      <div className={`${styles.stack} ${styles.panel}`}>
        <section className={styles.card} aria-label="התקדמות המתנה">
          <h2 className={styles.joined}>
            כבר <b>{sample.contributorCount}</b> חברים הצטרפו
          </h2>
          <p className={styles.nums}>
            <b>{formatGiftAmount(sample.raisedAmount)}</b>
            <span>מתוך {formatGiftAmount(sample.targetAmount)}</span>
            <span>{sample.percentOfTarget}%</span>
          </p>
          <div
            className={styles.track}
            role="img"
            aria-label={`${sample.percentOfTarget} אחוז מהיעד`}
          >
            <span />
          </div>
          <p className={styles.remain}>
            נותרו <b>{formatGiftAmount(sample.remainingAmount)}</b>
          </p>
        </section>

        <section className={`${styles.card} ${styles.gift}`}>
          <Image
            src={sample.giftImage}
            alt={sample.giftImageAlt}
            width={800}
            height={600}
            sizes="(min-width: 1100px) 420px, 100vw"
            style={{ width: "100%", height: "auto" }}
          />
          <div>
            <p className={styles.kickerLabel}>המשאלה</p>
            <h2>{sample.giftName}</h2>
            <p className={styles.muted}>{sample.giftDescription}</p>
            <p className={styles.muted}>יעד: {formatGiftAmount(sample.targetAmount)} אפשר להשתתף בכל סכום.</p>
          </div>
        </section>

        <div className={styles.chips} role="group" aria-label="סכום ההשתתפות">
          {sample.amounts.map((value) => {
            const selected = !customSelected && amount === value;
            return (
              <button
                key={value}
                type="button"
                className={`${styles.chip} ${selected ? styles.chipOn : ""}`}
                aria-pressed={selected}
                onClick={() => {
                  setAmount(value);
                  setCustomOpen(false);
                  setHint(false);
                }}
              >
                {formatGiftAmount(value)}
              </button>
            );
          })}
          <button
            type="button"
            className={`${styles.chip} ${customOpen ? styles.chipOn : ""}`}
            aria-pressed={customOpen}
            onClick={() => {
              setCustomOpen(true);
              const parsed = parseAmount(customValue);
              setAmount(parsed);
              setHint(false);
            }}
          >
            {customSelected && amount > 0 ? formatGiftAmount(amount) : "סכום אחר"}
          </button>
        </div>

        {customOpen ? (
          <label className={styles.custom}>
            הזינו סכום
            <input
              type="number"
              min={1}
              inputMode="numeric"
              dir="ltr"
              value={customValue}
              onChange={(event) => {
                const value = event.target.value;
                setCustomValue(value);
                setAmount(parseAmount(value));
                setHint(false);
              }}
            />
          </label>
        ) : null}

        {hint || amount <= 0 ? (
          <p id="join-amount-hint" className={styles.hint} role="alert">
            בחרו סכום כדי להצטרף
          </p>
        ) : null}

        {amount > 0 ? (
          <Link className={styles.cta} href={greetingHref}>
            מצטרפים למתנה
          </Link>
        ) : (
          <button
            type="button"
            className={styles.cta}
            aria-describedby="join-amount-hint"
            onClick={() => setHint(true)}
          >
            מצטרפים למתנה
          </button>
        )}

        <p className={styles.demo}>
          <strong>תשלום הדגמה — לא מתבצע חיוב אמיתי</strong>
          {BETA_CLARITY}
        </p>
      </div>
    </div>
  );
}
