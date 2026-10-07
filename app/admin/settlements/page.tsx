import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { formatGiftAmount } from "@/lib/guest-draft";
import { settlementBatchLabel } from "@/lib/settlements/labels";
import { SETTLEMENT_SCHEMA_MESSAGE } from "@/lib/settlements/messages";
import { listSettlements, listStoreBalances } from "@/lib/settlements/repository";
import { SETTLEMENT_STATUSES, type SettlementStatus } from "@/lib/settlements/types";
import { formatVoucherWhen } from "@/lib/vouchers/labels";
import { isUuid } from "@/lib/vouchers/input";
import SettlementFigures from "@/components/settlement-figures";
import CreateSettlementButton from "./create-settlement-button";

export const metadata: Metadata = {
  title: "התחשבנויות | LOLO",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ status?: string; store?: string }>;
};

function statusClass(status: string, overdue: boolean) {
  if (overdue) {
    return "bg-amber-100 text-amber-950";
  }
  if (status === "PAID") {
    return "bg-emerald-100 text-emerald-950";
  }
  if (status === "CANCELLED") {
    return "bg-zinc-100 text-zinc-600";
  }
  return "bg-brand-soft text-brand";
}

export default async function AdminSettlementsPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  const params = await searchParams;
  const statusParam = params.status ?? "";
  const status =
    statusParam === "overdue" || SETTLEMENT_STATUSES.includes(statusParam as SettlementStatus)
      ? (statusParam as SettlementStatus | "overdue")
      : "";
  const storeId = params.store && isUuid(params.store) ? params.store : "";
  let balances: Awaited<ReturnType<typeof listStoreBalances>> = [];
  let settlements: Awaited<ReturnType<typeof listSettlements>> = [];
  let loadError = "";

  try {
    [balances, settlements] = await Promise.all([
      listStoreBalances(),
      listSettlements({
        status,
        storeId: storeId || undefined,
      }),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : SETTLEMENT_SCHEMA_MESSAGE;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-4xl">התחשבנויות</h1>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted">
          לחיצה על יצירת התחשבנות אוספת את כל המימושים שטרם הוסדרו לבית העסק. התשלום לבית העסק הוא
          הסכום שמומש פחות העמלה שנשמרה בעת המימוש.
        </p>
      </header>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
        העמלה מעוגלת לאגורה הקרובה. חצי אגורה ומעלה מעוגלת כלפי מעלה, והיתרה היא הסכום לבית העסק.
        תאריך היעד הוא מועד המימוש ועוד ימי התשלום שנשמרו באותו מימוש. כשיש כמה מימושים, היעד הוא
        המועד המוקדם ביותר. דמי השירות מאורחים אינם חלק מהסכום לבית העסק.
      </p>

      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}

      {!loadError ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold">יתרות בתי עסק</h2>
          {balances.length === 0 ? (
            <p className="mt-4 text-base text-muted">אין בתי עסק להצגה.</p>
          ) : (
            <ul className="mt-4 grid gap-3 lg:grid-cols-2">
              {balances.map((balance) => (
                <li key={balance.storeId} className="rounded-3xl border border-border bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-lg font-bold">{balance.storeName}</h3>
                    <Link
                      href={`/admin/settlements?store=${balance.storeId}`}
                      className="text-sm font-semibold text-brand"
                    >
                      להתחשבנויות
                    </Link>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-muted">טרם הוסדר</dt>
                      <dd className="mt-1 font-bold">{formatGiftAmount(balance.unsettledPayable)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">ממתין</dt>
                      <dd className="mt-1 font-bold">{formatGiftAmount(balance.pendingPayable)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">שולם</dt>
                      <dd className="mt-1 font-bold">{formatGiftAmount(balance.paidPayable)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm text-muted">
                    {balance.unsettledCount.toLocaleString("he-IL")} מימושים ממתינים
                    {balance.unsettledCount > 0
                      ? ` · עמלה ${formatGiftAmount(balance.unsettledCommission)}`
                      : ""}
                  </p>
                  <div className="mt-4">
                    <CreateSettlementButton
                      storeId={balance.storeId}
                      disabled={balance.unsettledCount === 0}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-xl font-bold">רשימת התחשבנויות</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" method="get">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            סטטוס
            <select
              name="status"
              defaultValue={status}
              className="h-12 rounded-2xl border border-border bg-white px-4 font-normal"
            >
              <option value="">הכול</option>
              <option value="PENDING">ממתינה לתשלום</option>
              <option value="overdue">באיחור</option>
              <option value="PAID">שולמה</option>
              <option value="CANCELLED">בוטלה</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            בית עסק
            <select
              name="store"
              defaultValue={storeId}
              className="h-12 rounded-2xl border border-border bg-white px-4 font-normal"
            >
              <option value="">הכול</option>
              {balances.map((balance) => (
                <option key={balance.storeId} value={balance.storeId}>
                  {balance.storeName}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center self-end rounded-full bg-brand px-6 font-semibold text-white"
          >
            סינון
          </button>
        </form>

        {!loadError && settlements.length === 0 ? (
          <p className="mt-6 text-base text-muted">אין התחשבנויות להצגה.</p>
        ) : null}

        <ul className="mt-4 flex flex-col gap-3">
          {settlements.map((settlement) => (
            <li
              key={settlement.id}
              className={`rounded-3xl border p-5 ${
                settlement.overdue ? "border-amber-300 bg-amber-50" : "border-border bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{settlement.storeName}</p>
                  <p className="mt-1 text-sm text-muted">
                    יעד {formatVoucherWhen(settlement.dueAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClass(settlement.status, settlement.overdue)}`}
                >
                  {settlement.overdue ? "באיחור" : settlementBatchLabel(settlement.status)}
                </span>
              </div>
              <div className="mt-4">
                <SettlementFigures
                  gross={settlement.grossAmount}
                  commission={settlement.commissionAmount}
                  payable={settlement.payableAmount}
                />
              </div>
              <Link
                href={`/admin/settlements/${settlement.id}`}
                className="mt-4 inline-flex text-sm font-semibold text-brand"
              >
                לפירוט
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
