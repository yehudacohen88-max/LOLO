import type { Metadata } from "next";
import Link from "next/link";
import GuestDetailsForm from "./guest-details-form";

export const metadata: Metadata = {
  title: "פרטי האורח | LOLO",
};

export default function GuestDetailsPage() {
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
          <p className="mt-5 text-sm font-medium text-brand">שלב 3 מתוך 4</p>
          <h1 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            עוד רגע מסיימים
          </h1>
          <p className="mt-3 text-base text-muted sm:text-lg">
            נשמח לדעת ממי המתנה
          </p>
        </header>
        <GuestDetailsForm />
      </main>
    </div>
  );
}
