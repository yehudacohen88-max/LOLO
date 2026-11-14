import Link from "next/link";
import LoloMark from "@/app/design/lolo-mark";
import { BETA_CLARITY } from "@/app/design/beta-notice";
import { ILLUSTRATIVE_LABEL, libraryBySlug, type LibraryImage } from "@/lib/image-library";
import styles from "./premium-home.module.css";

const hero = libraryBySlug("candle-layer-cake", "hero");
const together = libraryBySlug("ribbon-box", "card");
const business = libraryBySlug("kitchen-machine", "card");

const steps = [
  {
    number: "1",
    title: "יוצרים אירוע",
    body: "בוחרים מתנה אחת שהחוגג באמת רוצה, ואת בית העסק שבו יממשו אותה.",
    image: libraryBySlug("candle-layer-cake", "card"),
  },
  {
    number: "2",
    title: "האורחים משתתפים יחד",
    body: "כל אורח נכנס מהקישור האישי, בוחר סכום ומשאיר ברכה. בלי הרשמה.",
    image: together,
  },
  {
    number: "3",
    title: "שובר לבית העסק",
    body: "ההשתתפות נאספת למתנה אחת, והחוגג מקבל שובר דיגיטלי. בבטא התשלום הוא הדגמה, בלי חיוב אמיתי.",
    image: business,
  },
];

const trust = [
  {
    title: "קישור אישי",
    body: "אורחים לא נרשמים לאתר. הם נכנסים רק מהקישור שקיבלו מהמארח.",
  },
  {
    title: "מתנה אחת ברורה",
    body: "כולם משתתפים באותה מתנה, לא בפיזור של הפתעות למגירה.",
  },
  {
    title: "מה קורה בבטא",
    body: BETA_CLARITY,
  },
];

function StockPhoto({
  image,
  framed = false,
}: {
  image: LibraryImage;
  framed?: boolean;
}) {
  return (
    <figure className={framed ? styles.heroFigure : styles.stepFigure}>
      <picture>
        <source srcSet={image.avif} type="image/avif" />
        <img
          src={image.file}
          alt={image.altHe}
          width={image.width}
          height={image.height}
          decoding="async"
        />
      </picture>
      <figcaption data-illustrative-label="">{ILLUSTRATIVE_LABEL}</figcaption>
    </figure>
  );
}

export default function PremiumHome({
  showSimulationBanner = false,
}: {
  showSimulationBanner?: boolean;
}) {
  return (
    <div className={styles.page} data-bold-home="">
      {showSimulationBanner ? <p className={styles.simLabel}>הדמיה — לא באתר החי</p> : null}
      <main className={styles.main}>
        <header className={styles.top}>
          <p className={styles.brand}>
            <LoloMark />
          </p>
        </header>

        <section className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.kicker}>מתנה אחת, מכולם</p>
            <h1>המתנה שבאמת רציתם, ביחד.</h1>
            <p className={styles.lede}>
              האורחים משתתפים יחד במתנה שהחוגג באמת רוצה. החוגג מקבל שובר דיגיטלי לבית עסק שבחר.
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
          <div className={styles.stage}>
            <StockPhoto image={hero} framed />
            <div className={styles.voucher}>
              <p className={styles.voucherKicker}>מה שהחוגג מקבל</p>
              <p className={styles.voucherTitle}>שובר דיגיטלי</p>
              <p className={styles.voucherNote}>לבית העסק שנבחר לאירוע. בבטא לא מונפק שובר אמיתי.</p>
            </div>
          </div>
        </section>

        <section className={styles.steps} aria-label="איך זה עובד">
          <h2>איך זה עובד</h2>
          <ol>
            {steps.map((step) => (
              <li key={step.number}>
                <StockPhoto image={step.image} />
                <div>
                  <span aria-hidden="true">{step.number}</span>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.trust} aria-label="למה לסמוך">
          <h2>שקט למארח ולאורחים</h2>
          <ul>
            {trust.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.close}>
          <h2>האירוע נראה מוכן עוד לפני שמעלים תמונה.</h2>
          <p>תמונת כיסוי ותמונת מתנה נבחרות מהספרייה לפי סוג האירוע. אפשר להחליף אותן בתמונה שלכם, ולחזור לברירת המחדל.</p>
          <Link className={styles.primary} href="/create-event?new=1">
            מתחילים ליצור אירוע
          </Link>
        </section>
      </main>
    </div>
  );
}
