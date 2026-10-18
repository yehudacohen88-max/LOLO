import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/design/host-experience.module.css";
import HostLoginForm from "./host-login-form";

export const metadata: Metadata = {
  title: "כניסה לניהול האירוע | LOLO",
};

export default function HostLoginPage() {
  return (
    <div className={styles.login}>
      <section className={styles.loginCopy}>
        <Link href="/" className={styles.wordmark}>
          LOLO
        </Link>
        <h1 className={styles.title}>כניסה לניהול האירוע</h1>
        <p className={styles.lede}>הזינו את קישור האירוע ואת קוד הניהול הפרטי</p>
      </section>
      <section className={styles.loginCard}>
        <HostLoginForm />
      </section>
    </div>
  );
}
