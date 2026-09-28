import type { Metadata } from "next";
import Link from "next/link";
import ThankYouView from "./thank-you-view";

export const metadata: Metadata = {
  title: "תודה | LOLO",
};

export default function ThankYouPage() {
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
          <h1 className="mt-8 text-3xl font-bold text-foreground">תודה ❤️</h1>
          <p className="mt-3 text-lg text-muted">ההזמנה נשמרה וממתינה לתשלום</p>
        </header>
        <ThankYouView />
      </main>
    </div>
  );
}
