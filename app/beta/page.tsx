import type { Metadata } from "next";
import Link from "next/link";
import LoloMark from "@/app/design/lolo-mark";
import styles from "@/app/design/host-experience.module.css";
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
        <h1 className={styles.title}>כניסה לבטא</h1>
        <p className={styles.lede}>
          הזינו את סיסמת הבטא פעם אחת. אחר כך הקישורים שקיבלתם ייפתחו כרגיל.
        </p>
      </section>
      <section className={styles.loginCard}>
        {misconfigured ? (
          <p className="rounded-3xl border border-border bg-white px-5 py-4 text-center text-sm leading-relaxed text-foreground">
            {message}
          </p>
        ) : (
          <form
            method="post"
            action="/api/beta/login"
            className="flex flex-col gap-5"
          >
            <input type="hidden" name="next" value={next} />
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-foreground">
                סיסמת בטא
              </span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                required
                className="h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none focus:border-brand"
              />
            </label>
            {message ? (
              <p
                role="alert"
                className="text-center text-sm font-semibold text-brand"
              >
                {message}
              </p>
            ) : null}
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover"
            >
              כניסה
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
