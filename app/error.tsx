"use client";

import Link from "next/link";
import { useEffect } from "react";
import BrandMark from "@/components/brand-mark";

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
      <BrandMark as="text" />
      <h1 className="lolo-title mt-8">
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
