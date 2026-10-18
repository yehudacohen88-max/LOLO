import type { Metadata } from "next";
import { Suspense } from "react";
import PageHeader from "@/components/page-header";
import SuccessActions from "./success-actions";

export const metadata: Metadata = {
  title: "האירוע מוכן | LOLO",
};

export default function SuccessPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          title="האירוע שלכם מוכן"
          subtitle="עכשיו נשאר רק להזמין את האורחים."
        />
        <div className="lolo-celebration mt-8" aria-hidden>
          <span className="cele-base" />
          <span className="cele-lid" />
          <span className="cele-bow" />
        </div>

        <Suspense fallback={<p className="mt-10 text-center text-sm text-muted">טוענים...</p>}>
          <SuccessActions />
        </Suspense>
      </main>
    </div>
  );
}
