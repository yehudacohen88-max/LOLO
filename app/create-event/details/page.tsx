import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import EventDetailsForm from "./event-details-form";

export const metadata: Metadata = {
  title: "פרטי האירוע | LOLO",
  description: "עוד כמה פרטים והאירוע מוכן",
};

export default function EventDetailsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          step={3}
          total={4}
          title="עוד כמה פרטים והאירוע מוכן"
          subtitle="עכשיו נוסיף את מה שהאורחים שלכם יראו"
        />

        <EventDetailsForm />
      </main>
    </div>
  );
}
