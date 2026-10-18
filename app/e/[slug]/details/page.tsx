import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import GuestDetailsForm from "./guest-details-form";

export const metadata: Metadata = {
  title: "פרטי האורח | LOLO",
};

export default function GuestDetailsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          step={3}
          total={4}
          title="עוד רגע מסיימים"
          subtitle="נשמח לדעת ממי המתנה"
        />
        <GuestDetailsForm />
      </main>
    </div>
  );
}
