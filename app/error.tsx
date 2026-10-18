"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[LOLO] page error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-5 py-16 text-center sm:py-24">
      <p className="text-4xl font-extrabold tracking-[0.28em] text-brand">LOLO</p>
      <h1 className="mt-8 text-2xl font-bold leading-tight text-foreground sm:text-4xl">
        משהו השתבש
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted">
        לא הצלחנו להציג את העמוד. אפשר לנסות שוב, או לחזור לדף הבית.
      </p>
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover"
        >
          נסו שוב
        </button>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground hover:bg-brand-soft"
        >
          לדף הבית
        </Link>
      </div>
    </main>
  );
}
