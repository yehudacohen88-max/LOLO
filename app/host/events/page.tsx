import type { Metadata } from "next";
import Link from "next/link";
import LoloMark from "@/app/design/lolo-mark";
import styles from "@/app/design/bold-host.module.css";
import { listLinkedHostEvents, readIdentitySession } from "@/lib/host/identity-server";
import { isServiceUnavailable } from "@/lib/security/required-secret";
import MyEventsList from "./my-events-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "האירועים שלי | LOLO",
  robots: { index: false, follow: false },
};

export default async function MyEventsPage() {
  const session = await readIdentitySession();

  let events = null;
  let problem = "";
  if (session) {
    try {
      events = await listLinkedHostEvents(session.identityId);
    } catch (error) {
      problem = isServiceUnavailable(error)
        ? "רשימת האירועים עדיין לא הופעלה."
        : "לא הצלחנו לטעון את הרשימה.";
      if (!isServiceUnavailable(error)) {
        console.error("[LOLO] my events", {
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    }
  }

  return (
    <div className={styles.login}>
      <section className={styles.loginCopy}>
        <Link href="/" className={styles.wordmark}>
          <LoloMark />
        </Link>
        <p className={styles.kicker}>למארחים</p>
        <h1 className={styles.title}>האירועים שלי</h1>
        <p className={styles.lede}>רק אירועים שקישרתם אחרי כניסה עם קוד הניהול</p>
      </section>
      <section className={styles.loginCard}>
        {!session ? (
          <>
            <p className={styles.help}>
              הרשימה נפתחת אחרי קישור אימייל מתוך ניהול האירוע. היא לא מציגה אירועים של מארחים אחרים.
            </p>
            <Link href="/host" className={styles.primary}>
              כניסה עם קוד
            </Link>
          </>
        ) : null}
        {problem ? <p className={styles.help}>{problem}</p> : null}
        {events ? <MyEventsList events={events} /> : null}
        <p className={styles.help}>
          <Link href="/host/recovery">שחזור קוד ניהול</Link>
        </p>
      </section>
    </div>
  );
}
