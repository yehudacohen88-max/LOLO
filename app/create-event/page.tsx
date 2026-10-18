import type { Metadata } from "next";
import { Suspense } from "react";
import PageHeader from "@/components/page-header";
import CreateEventForm from "./create-event-form";

export const metadata: Metadata = {
  title: "יצירת אירוע | LOLO",
  description: "בואו ניצור את האירוע שלכם",
};

export default function CreateEventPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          step={1}
          total={4}
          title="בואו ניצור את האירוע שלכם"
          subtitle="כמה פרטים קטנים ומתחילים"
        />

        <Suspense fallback={<p className="mt-10 text-center text-sm text-muted">טוענים...</p>}>
          <CreateEventForm />
        </Suspense>
      </main>
    </div>
  );
}
