import type { Metadata } from "next";
import Link from "next/link";
import LoloMark from "@/app/design/lolo-mark";
import styles from "@/app/design/bold-host.module.css";
import { betaGateModeFromEnv, safeNextPath } from "@/lib/beta/gate";

export const metadata: Metadata = {
  title: "כניסה לבטא | LOLO",
};

type BetaPageProps = {
  searchParams: Promise<{ next?: string; notice?: string }>;
};

function noticeText(notice: string | undefined, misconfigured: boolean) {
  if (misconfigured || notice === "setup") {
    return "גישת הבטא עדיין לא הוגדרה. פנו למי שמפעיל את האתר.";
  }
  if (notice === "locked") {
    return "יותר מדי ניסיונות. נסו שוב מאוחר יותר.";
  }
  if (notice === "invalid") {
    return "הסיסמה שגויה.";
  }
  return "";
}

export default async function BetaPage({ searchParams }: BetaPageProps) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const misconfigured = betaGateModeFromEnv() === "misconfigured";
  const message = noticeText(params.notice, misconfigured);

  return (
    <div className={styles.login}>
      <section className={styles.loginCopy}>
        <Link href="/" className={styles.wordmark}>
          <LoloMark />
        </Link>
        <p className={styles.kicker}>בטא סגורה</p>
        <h1 className={styles.title}>כניסה לבטא</h1>
        <p className={styles.lede}>
          הזינו את סיסמת הבטא פעם אחת. אחר כך הקישורים שקיבלתם ייפתחו כרגיל.
        </p>
      </section>
      <section className={styles.loginCard}>
        {misconfigured ? (
          <p className={styles.notice}>{message}</p>
        ) : (
          <form method="post" action="/api/beta/login" className={styles.form}>
            <input type="hidden" name="next" value={next} />
            <label className={styles.field}>
              <span>סיסמת בטא</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                required
                className={styles.input}
              />
            </label>
            {message ? (
              <p role="alert" className={styles.error}>
                {message}
              </p>
            ) : null}
            <button type="submit" className={styles.primary}>
              כניסה
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
