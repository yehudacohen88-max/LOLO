import Link from "next/link";
import { Heebo } from "next/font/google";
import LoloMark from "@/app/design/lolo-mark";
import { BETA_CLARITY } from "@/app/design/beta-notice";
import styles from "./premium-home.module.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-premium-heebo",
  display: "swap",
});

const steps = [
  {
    number: "1",
    title: "יוצרים אירוע",
    body: "בוחרים מתנה אחת ואת היעד שלה.",
  },
  {
    number: "2",
    title: "משתפים את האורחים",
    body: "כל אורח נכנס מהקישור, בוחר סכום ומשאיר ברכה.",
  },
  {
    number: "3",
    title: "כולם באותה מתנה",
    body: "ההשתתפות נאספת למתנה אחת. בבטא התשלום הוא הדגמה, בלי חיוב אמיתי.",
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

export default function PremiumHome({
  showSimulationBanner = false,
}: {
  showSimulationBanner?: boolean;
}) {
  return (
    <div className={`${styles.page} ${heebo.variable}`}>
      {showSimulationBanner ? <p className={styles.simLabel}>הדמיה — לא באתר החי</p> : null}
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.brand}>
              <LoloMark />
            </p>
            <h1>המתנה שבאמת רציתם, ביחד.</h1>
            <p className={styles.lede}>
              יוצרים אירוע, משתפים את האורחים, וכולם משתתפים במתנה אחת.
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
                <div className={styles.phoneBrand} aria-hidden="true">
                  <LoloMark />
                </div>
                <p className={styles.examplePill}>דוגמה</p>
                <div className={styles.giftCard}>
                  <p className={styles.phoneKicker}>יום הולדת</p>
                  <p className={styles.phoneTitle}>אופני עיר</p>
                  <p className={styles.phoneMeta}>המתנה שבחרתם</p>
                  <div className={styles.track} aria-hidden="true">
                    <span />
                  </div>
                  <p className={styles.progressLabel}>
                    <b>72%</b>
                    <span>מהיעד</span>
                  </p>
                  <p className={styles.guestCount}>18 אורחים כבר השתתפו</p>
                </div>
              </div>
            </div>
            <div className={styles.voucher}>
              <Ribbon />
              <p className={styles.voucherKicker}>להמחשה בלבד</p>
              <p className={styles.voucherTitle}>שובר דיגיטלי</p>
              <p className={styles.voucherNote}>
                בבטא לא מונפק שובר אמיתי ולא מתבצע מימוש.
              </p>
            </div>
            <figcaption>המחשה של דף אירוע. לא אירוע חי, ולא שובר אמיתי.</figcaption>
          </figure>
        </section>

        <p className={styles.beta}>{BETA_CLARITY}</p>

        <section className={styles.steps} aria-label="איך זה עובד">
          <h2>איך זה עובד</h2>
          <ol>
            {steps.map((step) => (
              <li key={step.number}>
                <span aria-hidden="true">{step.number}</span>
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
