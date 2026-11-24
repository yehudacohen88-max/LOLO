import type { Metadata } from "next";
import Link from "next/link";
import LoloMark from "@/app/design/lolo-mark";
import styles from "@/app/design/bold-host.module.css";
import RecoveryForm from "./recovery-form";

export const metadata: Metadata = {
  title: "שחזור קוד ניהול | LOLO",
  robots: { index: false, follow: false },
};

export default function HostRecoveryPage() {
  return (
    <div className={styles.login}>
      <section className={styles.loginCopy}>
        <Link href="/" className={styles.wordmark}>
          <LoloMark />
        </Link>
        <p className={styles.kicker}>למארחים</p>
        <h1 className={styles.title}>שחזור קוד ניהול</h1>
        <p className={styles.lede}>הקוד הישן לא קיים בשרת, ולכן אי אפשר להציג אותו שוב</p>
      </section>
      <section className={styles.loginCard}>
        <RecoveryForm />
        <p className={styles.help}>
          <Link href="/host">חזרה לכניסה</Link>
        </p>
      </section>
    </div>
  );
}
