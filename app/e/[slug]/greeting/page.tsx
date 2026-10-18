import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import GuestGreetingForm from "./greeting-form";

export const metadata: Metadata = {
  title: "ברכה | LOLO",
};

export default function GuestGreetingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          step={2}
          total={4}
          title="משאירים ברכה"
          subtitle="אפשר להוסיף ברכה — וגם להמשיך בלי"
        />
        <GuestGreetingForm />
      </main>
    </div>
  );
}
