import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { formatGiftAmount } from "@/lib/guest-draft";
import { settlementsEnabled } from "@/lib/settlements/availability";
import { SETTLEMENT_SCHEMA_MESSAGE } from "@/lib/settlements/messages";
import { reconciliationBalances } from "@/lib/settlements/reconcile";
import { loadReconciliation } from "@/lib/settlements/reports";

export const metadata: Metadata = {
  title: "התאמת התחשבנות | LOLO",
};

export const dynamic = "force-dynamic";

export default async function AdminSettlementReconciliationPage() {
  if (!settlementsEnabled()) {
    notFound();
  }

  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  let report: Awaited<ReturnType<typeof loadReconciliation>> | null = null;
  let loadError = "";
  try {
    report = await loadReconciliation();
  } catch (error) {
    loadError = error instanceof Error ? error.message : SETTLEMENT_SCHEMA_MESSAGE;
  }

  const reconciliation = report?.reconciliation;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <Link href="/admin/settlements" className="text-sm font-semibold text-brand">
        לכל ההתחשבנויות
      </Link>
      <header className="mt-4">
        <h1 className="text-2xl font-bold sm:text-4xl">התאמה</h1>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted">
          הצפוי הוא מה שעוד צריך לשלם לבתי העסק. מה שסומן כשולם הוא רישום של מפעיל, לא תנועת כסף.
          הפרש מופיע כשסכום השורות אינו שווה לסכום שנשמר, כשסטטוס מימוש אינו תואם, או כשסומן תשלום
          בלי אסמכתה.
        </p>
      </header>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {reconciliation ? (
        <>
          <section className="mt-8 grid gap-3 sm:grid-cols-3">
            <article className="rounded-3xl border border-border bg-white px-5 py-5">
              <p className="text-sm text-muted">צפוי לתשלום</p>
              <p className="mt-2 text-2xl font-bold">{formatGiftAmount(reconciliation.expectedOutstanding)}</p>
            </article>
            <article className="rounded-3xl border border-border bg-white px-5 py-5">
              <p className="text-sm text-muted">סומן כשולם</p>
              <p className="mt-2 text-2xl font-bold">{formatGiftAmount(reconciliation.markedPaid)}</p>
            </article>
            <article className="rounded-3xl border border-border bg-white px-5 py-5">
              <p className="text-sm text-muted">שורות על התחשבנויות ששולמו</p>
              <p className="mt-2 text-2xl font-bold">{formatGiftAmount(reconciliation.settledFromLines)}</p>
            </article>
          </section>
          <p className="mt-4 text-sm text-muted">
            {reconciliationBalances(reconciliation)
              ? "סכום מה שסומן כשולם שווה לסכום השורות שלו."
              : "יש הפרש בין מה שסומן כשולם לבין סכום השורות."}
          </p>
          <section className="mt-8">
            <h2 className="text-xl font-bold">
              הפרשים ({reconciliation.discrepancyCount.toLocaleString("he-IL")})
            </h2>
            {reconciliation.discrepancies.length === 0 ? (
              <p className="mt-4 text-base text-muted">אין הפרשים.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {reconciliation.discrepancies.map((item, index) => (
                  <li key={`${item.kind}-${item.settlementId ?? "none"}-${index}`} className="rounded-3xl border border-border bg-white p-5">
                    <p className="font-bold">{item.storeName}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{item.detail}</p>
                    {item.settlementId ? (
                      <Link
                        href={`/admin/settlements/${item.settlementId}`}
                        className="mt-3 inline-flex text-sm font-semibold text-brand"
                      >
                        להתחשבנות
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
