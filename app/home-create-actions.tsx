"use client";

import Link from "next/link";
import { hasUnfinishedEventDraft } from "@/lib/event-draft";
import { useIsClient } from "@/lib/use-is-client";

export default function HomeCreateActions() {
  const isClient = useIsClient();
  const hasDraft = isClient && hasUnfinishedEventDraft();

  return (
    <div className="mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:flex-row sm:justify-center">
      {!isClient ? (
        <div
          className="inline-flex h-12 w-full sm:w-auto sm:min-w-44"
          aria-hidden
        />
      ) : hasDraft ? (
        <>
          <Link
            href="/create-event"
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover sm:w-auto sm:min-w-44"
          >
            המשך יצירת האירוע
          </Link>
          <Link
            href="/create-event?new=1"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground transition-colors hover:bg-brand-soft sm:w-auto sm:min-w-44"
          >
            יצירת אירוע חדש
          </Link>
        </>
      ) : (
        <Link
          href="/create-event?new=1"
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover sm:w-auto sm:min-w-44"
        >
          יצירת אירוע
        </Link>
      )}
      <button
        type="button"
        className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground transition-colors hover:bg-brand-soft sm:w-auto sm:min-w-44"
      >
        יש לי הזמנה
      </button>
    </div>
  );
}
