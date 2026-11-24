import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SettlementFigures from "@/components/settlement-figures";
import { formatGiftAmount } from "@/lib/guest-draft";
import { settlementsEnabled } from "@/lib/settlements/availability";
import { DEMO_REDEMPTION_LABEL } from "@/lib/settlements/labels";
import { SETTLEMENT_SCHEMA_MESSAGE } from "@/lib/settlements/messages";
import { loadSettlementReport } from "@/lib/settlements/reports";
import { getStoreSession } from "@/lib/store/session";
import StoreLogoutButton from "../redeem/logout-button";
import StoreDeskLinks from "../store-links";

export const metadata: Metadata = {
  title: "יתרה | LOLO",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StoreBalancePage() {
  if (!settlementsEnabled()) {
    notFound();
  }

  const session = await getStoreSession();
  if (!session) {
    redirect("/store");
  }

  let report: Awaited<ReturnType<typeof loadSettlementReport>> | null = null;
  let loadError = "";
  try {
    report = await loadSettlementReport(session.storeId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : SETTLEMENT_SCHEMA_MESSAGE;
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-2xl font-extrabold tracking-[0.22em] text-brand">
            LOLO
          </Link>
          <h1 className="mt-4 text-2xl font-bold">יתרה לתשלום</h1>
        </div>
        <StoreLogoutButton />
      </header>
      <StoreDeskLinks />
      <p className="mt-4 text-sm leading-relaxed text-muted">
        אותו חישוב כמו בדוח ההתחשבנות: עמלה ויעד מהערך שנשמר במימוש, או מההגדרות כשהן שמורות.
        מימושי הדגמה אינם נספרים לתשלום.
      </p>
      <div className="mt-4 flex flex-wrap gap-4">
        <Link href="/store/settlements" className="text-sm font-semibold text-brand">
          התחשבנויות
        </Link>
        <a href="/api/store/settlements/report" className="text-sm font-semibold text-brand">
          הורדת דוח (CSV)
        </a>
      </div>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {report ? (
        <section className="mt-6 rounded-3xl border border-border bg-white p-5">
          <SettlementFigures
            gross={report.totals.payableGross}
            commission={report.totals.payableCommission}
            payable={report.totals.payableAmount}
          />
          {report.totals.demoCount > 0 ? (
            <p className="mt-4 text-sm text-muted">
              {DEMO_REDEMPTION_LABEL}: {formatGiftAmount(report.totals.demoGross)} (
              {report.totals.demoCount.toLocaleString("he-IL")})
            </p>
          ) : null}
          {report.totals.blockedCount > 0 ? (
            <p className="mt-3 text-sm text-brand">
              {report.totals.blockedCount.toLocaleString("he-IL")} מימושים חסומים עד שיוגדרו עמלה,
              ימי תשלום וכלל עיגול.
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
