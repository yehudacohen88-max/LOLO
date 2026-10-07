import type { Metadata } from "next";
import Link from "next/link";
import { adminPasswordIsConfigured, getAdminSession } from "@/lib/admin/session";
import { formatGiftAmount } from "@/lib/guest-draft";
import { SETTLEMENT_SCHEMA_MESSAGE } from "@/lib/settlements/messages";
import { getAdminFinanceOverview } from "@/lib/settlements/repository";
import { formatVoucherWhen } from "@/lib/vouchers/labels";
import AdminLoginForm from "./admin-login-form";

export const metadata: Metadata = {
  title: "ניהול LOLO",
};

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
  emphasize = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border bg-white px-5 py-5 ${emphasize ? "border-brand" : "border-border"}`}
    >
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{value}</p>
      {hint ? <p className="mt-2 text-sm leading-relaxed text-muted">{hint}</p> : null}
    </article>
  );
}

function formatCount(value: number) {
  return value.toLocaleString("he-IL");
}

export default async function AdminHomePage() {
  const session = await getAdminSession();

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <header className="flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            כניסה לניהול LOLO
          </h1>
          <p className="mt-3 text-base text-muted sm:text-lg">האזור הזה מיועד לבעלי המערכת בלבד.</p>
        </header>
        {adminPasswordIsConfigured() ? null : (
          <p className="mt-8 text-center text-sm text-muted">הכניסה לניהול עדיין לא הופעלה.</p>
        )}
        <AdminLoginForm />
      </main>
    );
  }

  let snapshot: Awaited<ReturnType<typeof getAdminFinanceOverview>> | null = null;
  let loadError = "";
  try {
    snapshot = await getAdminFinanceOverview();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת הנתונים נכשלה.";
  }

  const overview = snapshot?.overview;
  const settlementMoney = snapshot?.settlementsReady ? overview : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground sm:text-4xl">לוח בקרה</h1>
        <p className="mt-2 max-w-3xl text-base text-muted">
          אירועים, מתנות, כסף ששולם, שוברים והתחשבנות מול בתי העסק.
        </p>
      </header>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {snapshot && !snapshot.settlementsReady ? (
        <p className="mt-6 text-sm text-brand">{SETTLEMENT_SCHEMA_MESSAGE}</p>
      ) : null}

      {overview ? (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-bold">פעילות</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="אירועים" value={formatCount(overview.eventCount)} />
              <StatCard label="מתנות" value={formatCount(overview.giftCount)} />
              <StatCard label="בתי עסק פעילים" value={formatCount(overview.activeStores)} />
              <StatCard label="בתי עסק לא פעילים" value={formatCount(overview.inactiveStores)} />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold">כסף מהאורחים</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="השתתפויות ששולמו"
                value={formatGiftAmount(overview.paidContribution)}
                hint={`${formatCount(overview.paidOrderCount)} הזמנות ששולמו מתוך ${formatCount(overview.orderCount)}`}
              />
              <StatCard
                label="דמי שירות מאורחים"
                value={formatGiftAmount(overview.guestFeeRevenue)}
                hint="נגבים בהזמנה. לא נספרים ליעד המתנה ולא לתשלום לבית העסק."
              />
              <StatCard
                label="שוברים שהונפקו"
                value={formatGiftAmount(overview.vouchersIssuedAmount)}
                hint={`${formatCount(overview.vouchersIssuedCount)} שוברים`}
              />
              <StatCard
                label="סכום שמומש"
                value={formatGiftAmount(overview.redeemedAmount)}
                hint={`${formatCount(overview.redeemedCount)} מימושים`}
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold">הכנסות LOLO</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
              הכנסות LOLO הן דמי השירות מאורחים ועוד עמלות בתי העסק. העמלה מחושבת מכל מימוש לפי האחוז
              שנשמר בו. דמי השירות שייכים להזמנות, לא להתחשבנות של בית עסק.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="הכנסות LOLO"
                value={formatGiftAmount(overview.loloRevenue)}
                hint={`${formatGiftAmount(overview.guestFeeRevenue)} דמי שירות + ${formatGiftAmount(overview.storeCommission)} עמלות`}
                emphasize
              />
              <StatCard label="עמלות מבתי עסק" value={formatGiftAmount(overview.storeCommission)} />
              <StatCard label="דמי שירות מאורחים" value={formatGiftAmount(overview.guestFeeRevenue)} />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold">תשלום לבתי עסק</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="לתשלום לבתי עסק"
                value={
                  settlementMoney
                    ? formatGiftAmount(settlementMoney.payableOutstanding)
                    : "—"
                }
                hint="טרם הוסדר ועוד התחשבנויות שממתינות לתשלום"
              />
              <StatCard
                label="טרם הוסדר"
                value={formatGiftAmount(overview.payableUnsettled)}
              />
              <StatCard
                label="ממתין לתשלום"
                value={settlementMoney ? formatGiftAmount(settlementMoney.payablePending) : "—"}
              />
              <StatCard
                label="שולם"
                value={settlementMoney ? formatGiftAmount(settlementMoney.payablePaid) : "—"}
              />
              <StatCard
                label="התחשבנויות באיחור"
                value={settlementMoney ? formatCount(settlementMoney.overdueCount) : "—"}
                hint={
                  settlementMoney
                    ? formatGiftAmount(settlementMoney.overduePayable)
                    : undefined
                }
              />
            </div>
            {snapshot?.settlementsReady && snapshot.overdue.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-3">
                {snapshot.overdue.slice(0, 6).map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-amber-300 bg-amber-50 px-5 py-4"
                  >
                    <div>
                      <p className="font-bold">{item.storeName}</p>
                      <p className="mt-1 text-sm text-muted">יעד {formatVoucherWhen(item.dueAt)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold">{formatGiftAmount(item.payableAmount)}</p>
                      <Link
                        href={`/admin/settlements/${item.id}`}
                        className="text-sm font-semibold text-brand"
                      >
                        לפתיחה
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/admin/settlements"
          className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white"
        >
          התחשבנויות
        </Link>
        <Link
          href="/admin/stores"
          className="inline-flex h-12 items-center justify-center rounded-full border border-brand px-6 text-base font-semibold text-brand"
        >
          בתי עסק
        </Link>
        <Link
          href="/admin/redemptions"
          className="inline-flex h-12 items-center justify-center rounded-full border border-brand px-6 text-base font-semibold text-brand"
        >
          מימושים
        </Link>
      </div>
    </main>
  );
}
