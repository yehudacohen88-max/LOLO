import type { Metadata } from "next";
import BrandMark from "@/components/brand-mark";
import GuestEventView from "./guest-event-view";

export const metadata: Metadata = {
  title: "האירוע | LOLO",
};

export default function GuestEventPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6 sm:max-w-xl sm:px-8 sm:py-10 lg:my-8 lg:max-w-2xl lg:rounded-[2rem] lg:border lg:border-border lg:bg-ivory/80 lg:px-10 lg:py-10 lg:shadow-[var(--shadow-card)]">
        <header className="flex justify-center">
          <BrandMark />
        </header>
        <GuestEventView />
      </main>
    </div>
  );
}
