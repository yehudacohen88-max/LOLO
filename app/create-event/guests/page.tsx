import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import GuestsForm from "./guests-form";

export const metadata: Metadata = {
  title: "הזמנת אורחים | LOLO",
  description: "את מי מזמינים?",
};

export default function GuestsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          step={4}
          total={4}
          title="את מי מזמינים?"
          subtitle="הוסיפו את האורחים שלכם. את ההזמנה נשלח בהמשך."
        />

        <GuestsForm />
      </main>
    </div>
  );
}
