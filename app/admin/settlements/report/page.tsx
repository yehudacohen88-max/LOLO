import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SettlementFigures from "@/components/settlement-figures";
import { getAdminSession } from "@/lib/admin/session";
import { formatGiftAmount } from "@/lib/guest-draft";
import { settlementsEnabled } from "@/lib/settlements/availability";
import { DEMO_REDEMPTION_LABEL } from "@/lib/settlements/labels";
import { SETTLEMENT_SCHEMA_MESSAGE } from "@/lib/settlements/messages";
import { statementReconciles } from "@/lib/settlements/statement";
import { loadSettlementReport } from "@/lib/settlements/reports";

export const metadata: Metadata = {
  title: "דוח התחשבנות | LOLO",
};

export const dynamic = "force-dynamic";

export default async function AdminSettlementReportPage() {
  if (!settlementsEnabled()) {
    notFound();
  }

  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  let report: Awaited<ReturnType<typeof loadSettlementReport>> | null = null;
  let loadError = "";
  try {
    report = await loadSettlementReport();
  } catch (error) {
    loadError = error instanceof Error ? error.message : SETTLEMENT_SCHEMA_MESSAGE;
  }

  const payable = report?.rows.filter((row) => row.section === "payable") ?? [];
  const demo = report?.rows.filter((row) => row.section === "demo") ?? [];
  const blocked = report?.rows.filter((row) => row.section === "blocked") ?? [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <Link href="/admin/settlements" className="text-sm font-semibold text-brand">
        לכל ההתחשבנויות
      </Link>
      <header className="mt-4">
        <h1 className="text-2xl font-bold sm:text-4xl">דוח התחשבנות</h1>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted">
          העמלה והיעד נלקחים מהערך שנשמר במימוש, או מברירת המחדל בהגדרות. מימושי הדגמה מוצגים לחוד
          ואינם נספרים לתשלום.
        </p>
      </header>
      <a
        href="/api/admin/settlements/report"
        className="mt-4 inline-flex h-12 w-fit items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-white"
      >
        הורדת CSV
      </a>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {report ? (
        <>
          <section className="mt-8 rounded-3xl border border-border bg-white p-5">
            <SettlementFigures
              gross={report.totals.payableGross}
              commission={report.totals.payableCommission}
              payable={report.totals.payableAmount}
            />
            <p className="mt-4 text-sm text-muted">
              {statementReconciles(report.totals)
                ? "העמלה והסכום לתשלום מסתכמים לסכום שמומש."
                : "הסכומים בדוח אינם מסתכמים. בדקו את ההתאמה."}
            </p>
          </section>
          {blocked.length > 0 ? (
            <p className="mt-6 text-sm text-brand">
              {blocked.length.toLocaleString("he-IL")} מימושים חסומים ואינם נספרים לתשלום, כי חסר
              אחוז עמלה, ימי תשלום, או כלל עיגול.
            </p>
          ) : null}
          <section className="mt-8">
            <h2 className="text-xl font-bold">לתשלום</h2>
            {payable.length === 0 ? (
              <p className="mt-4 text-base text-muted">אין שורות לתשלום.</p>
            ) : (
              <ReportList rows={payable} />
            )}
          </section>
          <section className="mt-8">
            <h2 className="text-xl font-bold">{DEMO_REDEMPTION_LABEL}</h2>
            <p className="mt-2 text-sm text-muted">
              {report.totals.demoCount.toLocaleString("he-IL")} מימושים ·{" "}
              {formatGiftAmount(report.totals.demoGross)} אינם לתשלום.
            </p>
            <ReportList rows={demo} />
          </section>
        </>
      ) : null}
    </main>
  );
}

function ReportList({
  rows,
}: {
  rows: Awaited<ReturnType<typeof loadSettlementReport>>["rows"];
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {rows.map((row) => (
        <li key={`${row.section}-${row.id}`} className="rounded-3xl border border-border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bold">{row.storeName}</p>
              <p className="mt-1 text-sm text-muted">
                {row.giftTitle}
                {row.eventTitle ? ` · ${row.eventTitle}` : ""}
              </p>
              <p className="mt-1 font-mono text-sm" dir="ltr">
                {row.voucherCode}
              </p>
            </div>
            <p className="text-lg font-bold">
              {row.section === "payable" && row.payableAmount != null
                ? formatGiftAmount(row.payableAmount)
                : DEMO_REDEMPTION_LABEL}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
