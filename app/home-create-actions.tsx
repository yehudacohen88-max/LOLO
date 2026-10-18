"use client";

import Link from "next/link";
import { hasUnfinishedEventDraft } from "@/lib/event-draft";
import { useIsClient } from "@/lib/use-is-client";

export default function HomeCreateActions() {
  const isClient = useIsClient();
  const hasDraft = isClient && hasUnfinishedEventDraft();

  const primaryClass =
    "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover sm:w-auto sm:min-w-52";
  const secondaryClass =
    "inline-flex min-h-12 w-full items-center justify-center rounded-full border border-border bg-ivory px-6 text-base font-semibold text-foreground transition-colors hover:bg-brand-soft sm:w-auto sm:min-w-44";

  return (
    <div className="mt-6 flex w-full flex-col items-center gap-3 lg:items-start">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
        {!isClient ? (
          <div className="inline-flex h-12 w-full sm:w-auto sm:min-w-52" aria-hidden />
        ) : hasDraft ? (
          <>
            <Link href="/create-event" className={primaryClass}>
              המשך יצירת האירוע
            </Link>
            <Link href="/create-event?new=1" className={secondaryClass}>
              יצירת אירוע חדש
            </Link>
          </>
        ) : (
          <Link href="/create-event?new=1" className={primaryClass}>
            יצירת אירוע
          </Link>
        )}
      </div>
      <Link
        href="/host"
        className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold text-brand underline-offset-4 hover:underline"
      >
        כניסה לניהול אירוע
      </Link>
      <p className="max-w-sm text-center text-sm leading-relaxed text-muted">
        אורחים לא נרשמים לכאן. הם נכנסים מהקישור האישי שקיבלו מהמארח.
      </p>
    </div>
  );
}
