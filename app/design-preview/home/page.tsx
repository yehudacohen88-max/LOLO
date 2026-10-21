import Link from "next/link";
import { BETA_CLARITY } from "@/app/design/beta-notice";
import styles from "./home-preview.module.css";

const steps = [
  {
    number: "1",
    title: "יוצרים אירוע",
    body: "המארח בוחר את המתנה שהחוגג באמת רוצה, ואת פרטי האירוע.",
  },
  {
    number: "2",
    title: "האורחים משתתפים",
    body: "כל אורח נכנס מהקישור האישי, בוחר סכום שמתאים לו ומשאיר ברכה.",
  },
  {
    number: "3",
    title: "מתנה אחת, ביחד",
    body: "ההשתתפות מצטברת למתנה אחת. היעד הוא יעד, לא תקרה.",
  },
];

export default function PremiumHomePreview() {
  return (
    <div className={styles.page}>
      <p className={styles.simLabel}>הדמיה — לא באתר החי</p>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.mark}>LOLO</p>
            <h1>המתנה שבאמת רצית</h1>
            <p className={styles.lede}>
              LOLO היא הדרך שבה אורחים משתתפים יחד במתנה אחת — המתנה שהחוגג
              באמת רוצה. המארח יוצר אירוע, כל אורח נכנס מהקישור ובוחר סכום,
              וההשתתפות נאספת למתנה אחת.
            </p>
            <p className={styles.support}>
              היעד של המתנה הוא יעד, לא תקרה. אפשר לעבור את 100%, והמארח רואה
              כמה באמת נאסף.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/create-event?new=1">
                יצירת אירוע
              </Link>
              <Link className={styles.secondary} href="/host">
                כניסה לניהול אירוע
              </Link>
            </div>
            <p className={styles.guestNote}>
              אורחים לא נרשמים לכאן. הם נכנסים מהקישור האישי שקיבלו מהמארח.
            </p>
          </div>
          <aside className={styles.giftCard} aria-label="המתנה האחת">
            <div className={styles.seal} aria-hidden="true">
              <span>מתנה</span>
            </div>
            <p className={styles.cardKicker}>מתנה אחת</p>
            <p className={styles.cardTitle}>כולם משתתפים באותה מתנה</p>
            <ul className={styles.cardList}>
              <li>החוגג ביקש משהו אחד, לא רשימת הפתעות.</li>
              <li>כל אורח בוחר סכום שמתאים לו.</li>
              <li>הברכות נשארות עם ההשתתפות.</li>
            </ul>
          </aside>
        </section>

        <section className={styles.steps} aria-label="איך זה עובד">
          <h2>איך זה עובד</h2>
          <ol>
            {steps.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className={styles.beta}>{BETA_CLARITY}</p>
      </main>
    </div>
  );
}
