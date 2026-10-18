import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import GiftChoiceForm from "./gift-choice-form";

export const metadata: Metadata = {
  title: "בחירת מתנות | LOLO",
  description: "איך תרצו לקבל מתנות?",
};

export default function GiftChoicePage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          step={2}
          total={4}
          title="איך תרצו לקבל מתנות?"
          subtitle="בחרו את האפשרות שמתאימה לאירוע שלכם"
        />

        <GiftChoiceForm />
      </main>
    </div>
  );
}
