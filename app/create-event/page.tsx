import type { Metadata } from "next";
import { Suspense } from "react";
import CreateFrame from "./create-frame";
import CreateEventForm from "./create-event-form";

export const metadata: Metadata = {
  title: "יצירת אירוע | LOLO",
  description: "בואו ניצור את האירוע שלכם",
};

export default function CreateEventPage() {
  return (
    <CreateFrame
      step={1}
      title="בואו ניצור את האירוע שלכם"
      lede="כמה פרטים קטנים ומתחילים"
    >
      <Suspense fallback={<p className="mt-10 text-center text-base text-muted">טוענים...</p>}>
        <CreateEventForm />
      </Suspense>
    </CreateFrame>
  );
}
