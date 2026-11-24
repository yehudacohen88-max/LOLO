import type { Metadata } from "next";
import Link from "next/link";
import { PILOT_FEEDBACK_CLOSED } from "@/lib/pilot/feedback";
import { pilotFeedbackTableReady } from "@/lib/pilot/feedback-store";
import FeedbackForm from "./feedback-form";

export const metadata: Metadata = {
  title: "משוב לפיילוט | LOLO",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const ready = await pilotFeedbackTableReady();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:py-16">
      <Link href="/" className="text-2xl font-extrabold tracking-[0.22em] text-brand">
        LOLO
      </Link>
      <h1 className="mt-6 text-2xl font-bold text-foreground sm:text-4xl">משוב לפיילוט</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        תשלום ב־LOLO כרגע הוא הדגמה. לא נגבה כסף, ואין צורך בכרטיס אשראי.
      </p>
      {ready ? <FeedbackForm /> : <p className="mt-8 text-base text-foreground">{PILOT_FEEDBACK_CLOSED}</p>}
    </main>
  );
}
