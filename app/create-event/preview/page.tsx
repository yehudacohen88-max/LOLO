import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import EventPreview from "./event-preview";

export const metadata: Metadata = {
  title: "תצוגה מקדימה | LOLO",
};

export default function PreviewPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader label="תצוגה מקדימה" />

        <EventPreview />
      </main>
    </div>
  );
}
