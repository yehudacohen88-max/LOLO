import Link from "next/link";
import LoloMark from "@/app/design/lolo-mark";
import { BETA_CLARITY } from "@/app/design/beta-notice";
import styles from "./home-preview.module.css";

const steps = [
  {
    number: "1",
    title: "יוצרים אירוע",
    body: "בוחרים את המתנה שהחוגג באמת רוצה, ואת העסק שבו יממשו אותה.",
  },
  {
    number: "2",
    title: "האורחים נותנים יחד",
    body: "כל אורח נכנס מהקישור, משתתף בסכום שמתאים לו ומשאיר ברכה.",
  },
  {
    number: "3",
    title: "שובר דיגיטלי",
    body: "החוגג מקבל שובר לעסק שבחר. בבטא זה עדיין הדגמה, בלי מימוש אמיתי.",
  },
];

function Ribbon() {
  return (
    <svg className={styles.ribbon} viewBox="0 0 72 28" aria-hidden="true">
      <path d="M36 14 C26 2 6 2 8 11 C10 18 26 18 36 14Z" fill="#E87563" />
      <path d="M36 14 C46 2 66 2 64 11 C62 18 46 18 36 14Z" fill="#E87563" />
      <circle cx="36" cy="14" r="4.2" fill="#C7A36A" />
    </svg>
  );
}

export default function PremiumHomePreview() {
  return (
    <div className={styles.page}>
      <p className={styles.simLabel}>הדמיה — לא באתר החי</p>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.brand}>
              <LoloMark />
            </p>
            <h1>האורחים נותנים יחד את המתנה שהחוגג באמת רוצה, והוא מקבל שובר דיגיטלי לעסק שבחר</h1>
            <p className={styles.lede}>
              המארח פותח אירוע למתנה אחת. כל אורח נכנס מהקישור האישי, בוחר סכום
              שמתאים לו ומשאיר ברכה. בסוף מחכה לחוגג שובר דיגיטלי לעסק שהוא בחר.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/create-event?new=1">
                יוצרים אירוע
              </Link>
              <Link className={styles.secondary} href="/host">
                כניסה לניהול אירוע
              </Link>
            </div>
            <p className={styles.guestNote}>
              אורחים לא נרשמים לכאן. הם נכנסים מהקישור האישי שקיבלו מהמארח.
            </p>
          </div>

          <figure className={styles.stage}>
            <div className={styles.phone}>
              <div className={styles.ear} aria-hidden="true" />
              <div className={styles.screen}>
                <div className={styles.phoneBrand}>
                  <LoloMark />
                </div>
                <p className={styles.examplePill}>דוגמה</p>
                <p className={styles.phoneKicker}>יום הולדת</p>
                <p className={styles.phoneTitle}>אופני עיר</p>
                <p className={styles.phoneMeta}>המתנה שהחוגג בחר</p>
                <div
                  className={styles.track}
                  role="img"
                  aria-label="72 אחוז מהיעד, 18 אורחים כבר השתתפו"
                >
                  <span />
                </div>
                <p className={styles.progressLabel}>
                  <b>72%</b>
                  <span>18 אורחים כבר בפנים</span>
                </p>
              </div>
            </div>
            <div className={styles.voucher}>
              <Ribbon />
              <p className={styles.voucherKicker}>שובר דיגיטלי</p>
              <p className={styles.voucherTitle}>לעסק שהחוגג בחר</p>
              <p className={styles.voucherNote}>כרטיס להמחשה. לא שובר אמיתי.</p>
            </div>
            <figcaption>המחשה של דף האירוע והשובר. לא אירוע חי.</figcaption>
          </figure>
        </section>

        <p className={styles.beta}>{BETA_CLARITY}</p>

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
      </main>
    </div>
  );
}
