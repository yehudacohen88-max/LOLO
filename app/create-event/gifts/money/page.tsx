import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import MoneyGiftForm from "./money-gift-form";

export const metadata: Metadata = {
  title: "מתנה כספית | LOLO",
  description: "הגדירו איך האורחים יוכלו להעניק לכם מתנה",
};

export default function MoneyGiftPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          step={2}
          total={4}
          title="מתנה כספית"
          subtitle="הגדירו איך האורחים יוכלו להעניק לכם מתנה"
        />

        <MoneyGiftForm />
      </main>
    </div>
  );
}
