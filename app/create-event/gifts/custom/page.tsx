import type { Metadata } from "next";
import { Suspense } from "react";
import PageHeader from "@/components/page-header";
import CustomGiftForm from "./custom-gift-form";

export const metadata: Metadata = {
  title: "מתנה משלכם | LOLO",
  description: "הוספת מתנה עם תמונה, יעד וחנות",
};

export default function CustomGiftPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          step={2}
          total={4}
          title="מתנה משלכם"
          subtitle="שם, תמונה ויעד. החנות והתיאור לא חובה."
        />

        <Suspense fallback={null}>
          <CustomGiftForm />
        </Suspense>
      </main>
    </div>
  );
}
