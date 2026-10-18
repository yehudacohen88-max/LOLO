import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import GuestPaymentSummary from "./payment-summary";

export const metadata: Metadata = {
  title: "תשלום | LOLO",
};

export default function GuestPaymentPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          step={4}
          total={4}
          title="ההשתתפות שלכם"
          notice="גרסת בטא — תשלומים מדומים בלבד"
          subtitle="זהו סיכום ההשתתפות. לא מתבצע חיוב אמיתי."
        />
        <GuestPaymentSummary />
      </main>
    </div>
  );
}
