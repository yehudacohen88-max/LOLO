import Link from "next/link";
import styles from "@/app/design/guest-premium.module.css";

export default function GuestPremiumMissing() {
  return (
    <div className={styles.missing}>
      <p className={styles.example}>דוגמה</p>
      <section className={styles.card}>
        <h1>האירוע לא נמצא</h1>
        <p>הקישור לא מוביל לאירוע פעיל. בקשו מהמארח קישור חדש, או חזרו לדף הבית.</p>
        <Link className={styles.cta} href="/">
          לדף הבית
        </Link>
      </section>
      <section className={styles.card} aria-label="קישור אישי לא פעיל">
        <h2 className={styles.flowTitle}>ההזמנה לא נמצאה</h2>
        <p>הקישור האישי אינו פעיל. בקשו מהמארח לשלוח הזמנה חדשה.</p>
        <p>שני המצבים נראים אותו דבר לאורח: אין פרטי מארח, אין רשימת אורחים, ואין הבחנה בין קישור שגוי לאירוע שלא פורסם.</p>
      </section>
    </div>
  );
}
