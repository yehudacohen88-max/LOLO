import type { Metadata } from "next";
import Link from "next/link";
import GuestEventView from "./guest-event-view";

export const metadata: Metadata = {
  title: "האירוע | LOLO",
};

export default function GuestEventPage() {
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
        </header>
        <GuestEventView />
      </main>
    </div>
  );
}
