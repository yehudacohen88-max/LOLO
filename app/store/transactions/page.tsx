import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { deskDb } from "@/lib/desk/http";
import {
  listStoreTransactions,
  parseDay,
  parseTransactionKind,
} from "@/lib/desk/transactions";
import { formatGiftAmount } from "@/lib/guest-draft";
import { DEMO_REDEMPTION_LABEL } from "@/lib/settlements/labels";
import { getStoreSession } from "@/lib/store/session";
import { formatVoucherWhen, redemptionChannelLabel } from "@/lib/vouchers/labels";
import StoreLogoutButton from "../redeem/logout-button";
import StoreDeskLinks from "../store-links";

export const metadata: Metadata = {
  title: "היסטוריית מימושים | LOLO",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string; kind?: string }>;
};

export default async function StoreTransactionsPage({ searchParams }: PageProps) {
  const session = await getStoreSession();
  if (!session) {
    redirect("/store");
  }

  const params = await searchParams;
  const from = parseDay(params.from);
  const to = parseDay(params.to);
  const kind = parseTransactionKind(params.kind);
  const exportQuery = new URLSearchParams();
  if (from) exportQuery.set("from", from);
  if (to) exportQuery.set("to", to);
  if (kind !== "all") exportQuery.set("kind", kind);
  const exportParams = exportQuery.toString();
  const exportHref = `/api/store/transactions/export${exportParams ? `?${exportParams}` : ""}`;

  let page = null;
  let loadError = "";
  try {
    page = await listStoreTransactions(session.storeId, { from, to, kind }, deskDb());
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת המימושים נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8 sm:max-w-3xl sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-2xl font-extrabold tracking-[0.22em] text-brand">
            LOLO
          </Link>
          <h1 className="mt-4 text-2xl font-bold">היסטוריית מימושים</h1>
          <p className="mt-1 text-sm text-muted">רק המימושים של בית העסק הזה.</p>
        </div>
        <StoreLogoutButton />
      </header>
      <StoreDeskLinks />
      <form className="mt-6 grid gap-3 sm:grid-cols-4" method="get">
        <label className="flex flex-col gap-2 text-sm font-semibold">
          מ-
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="h-12 rounded-2xl border border-border bg-white px-3 font-normal"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">
          עד
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="h-12 rounded-2xl border border-border bg-white px-3 font-normal"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">
          סיווג
          <select
            name="kind"
            defaultValue={kind}
            className="h-12 rounded-2xl border border-border bg-white px-3 font-normal"
          >
            <option value="all">הכול</option>
            <option value="standard">אינם הדגמה</option>
            <option value="demo">הדגמה</option>
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-12 items-end justify-center self-end rounded-full bg-brand px-6 font-semibold text-white"
        >
          סינון
        </button>
      </form>
      <a href={exportHref} className="mt-4 text-sm font-semibold text-brand">
        הורדת CSV
      </a>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {page && !page.available ? <p className="mt-6 text-sm text-brand">{page.message}</p> : null}
      {page?.message && page.available ? <p className="mt-6 text-sm text-brand">{page.message}</p> : null}
      {page?.classificationAvailable ? (
        <section className="mt-6 rounded-3xl border border-border bg-white p-5">
          <p className="text-sm text-muted">סכום מימושים שאינם הדגמה, לפני עמלה</p>
          <p className="mt-2 text-2xl font-bold">{formatGiftAmount(page.standardGross ?? 0)}</p>
          {(page.demoGross ?? 0) > 0 ? (
            <p className="mt-3 text-sm text-muted">
              {DEMO_REDEMPTION_LABEL}: {formatGiftAmount(page.demoGross ?? 0)}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-muted">הסכום לתשלום אחרי עמלה מופיע במסך היתרה.</p>
        </section>
      ) : null}
      {page?.available && page.rows.length === 0 && !loadError ? (
        <p className="mt-8 text-base text-muted">אין מימושים להצגה.</p>
      ) : null}
      <ul className="mt-6 flex flex-col gap-3">
        {page?.rows.map((row) => (
          <li key={row.id} className="rounded-3xl border border-border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{row.giftTitle || "מתנה"}</p>
                <p className="mt-1 text-sm text-muted">{row.eventTitle}</p>
              </div>
              <p className="text-xl font-bold">{formatGiftAmount(row.amount)}</p>
            </div>
            {row.label ? <p className="mt-3 text-sm font-semibold text-brand">{row.label}</p> : null}
            <p className="mt-2 text-sm text-muted">
              {formatVoucherWhen(row.redeemedAt)} · {redemptionChannelLabel(row.channel)}
            </p>
            <p className="mt-1 font-mono text-sm" dir="ltr">
              {row.voucherCode}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
