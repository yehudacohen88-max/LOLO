import type { Metadata } from "next";
import BrandMark from "@/components/brand-mark";
import GuestEventView from "./guest-event-view";

export const metadata: Metadata = {
  title: "האירוע | LOLO",
};

export default function GuestEventPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6 sm:px-6 lg:max-w-6xl lg:px-10 lg:py-12 xl:max-w-7xl">
        <header className="flex justify-center lg:justify-start">
          <BrandMark />
        </header>
        <GuestEventView />
      </main>
    </div>
  );
}
