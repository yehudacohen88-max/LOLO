import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import SuccessActions from "./success-actions";

export const metadata: Metadata = {
  title: "האירוע מוכן | LOLO",
};

export default function SuccessPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <header className="flex flex-col items-center text-center">
          <Link
            href="/"
            className="text-4xl font-extrabold tracking-[0.28em] text-brand sm:text-5xl"
          >
            LOLO
          </Link>
          <h1 className="mt-8 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            האירוע שלכם מוכן 🎉
          </h1>
          <p className="mt-3 text-base text-muted sm:text-lg">
            עכשיו נשאר רק להזמין את האורחים.
          </p>
        </header>

        <Suspense fallback={<p className="mt-10 text-center text-sm text-muted">טוענים...</p>}>
          <SuccessActions />
        </Suspense>
      </main>
    </div>
  );
}
