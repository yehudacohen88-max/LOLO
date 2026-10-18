import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import ThankYouView from "./thank-you-view";

export const metadata: Metadata = {
  title: "תודה | LOLO",
};

export default function ThankYouPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          title="תודה"
          subtitle="החלק שלכם במתנה כבר בפנים."
          notice="גרסת בטא — תשלומים מדומים בלבד"
        />
        <ThankYouView />
      </main>
    </div>
  );
}
