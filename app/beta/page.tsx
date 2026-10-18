import type { Metadata } from "next";
import Link from "next/link";
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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-md sm:py-16">
      <header className="text-center">
        <Link href="/" className="text-4xl font-extrabold tracking-[0.28em] text-brand">
          LOLO
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-foreground">כניסה לבטא</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          הזינו את סיסמת הבטא פעם אחת. אחר כך הקישורים שקיבלתם ייפתחו כרגיל.
        </p>
      </header>
      {misconfigured ? (
        <p className="mt-10 rounded-3xl border border-border bg-white px-5 py-4 text-center text-sm leading-relaxed text-foreground">
          {message}
        </p>
      ) : (
        <form method="post" action="/api/beta/login" className="mt-10 flex flex-col gap-5">
          <input type="hidden" name="next" value={next} />
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">סיסמת בטא</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              required
              className="h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none focus:border-brand"
            />
          </label>
          {message ? <p className="text-center text-sm text-brand">{message}</p> : null}
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover"
          >
            כניסה
          </button>
        </form>
      )}
    </main>
  );
}
