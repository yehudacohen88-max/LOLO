import type { Metadata } from "next";
import Link from "next/link";
import { adminPasswordIsConfigured, getAdminSession } from "@/lib/admin/session";
import { countEvents, countOrders, countStoresByStatus } from "@/lib/admin/stores";
import AdminLoginForm from "./admin-login-form";

export const metadata: Metadata = {
  title: "ניהול LOLO",
};

export const dynamic = "force-dynamic";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-3xl border border-border bg-white px-5 py-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
    </article>
  );
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
          <p className="mt-3 text-base text-muted sm:text-lg">
            האזור הזה מיועד לבעלי המערכת בלבד.
          </p>
        </header>
        {adminPasswordIsConfigured() ? null : (
          <p className="mt-8 text-center text-sm text-muted">
            הניהול עדיין לא הוגדר בשרת.
          </p>
        )}
        <AdminLoginForm />
      </main>
    );
  }

  let activeStores = "—";
  let inactiveStores = "—";
  let events = "—";
  let orders = "—";
  let loadError = "";

  try {
    const [stores, eventCount, orderCount] = await Promise.all([
      countStoresByStatus(),
      countEvents(),
      countOrders(),
    ]);
    activeStores = stores.active.toLocaleString("he-IL");
    inactiveStores = stores.inactive.toLocaleString("he-IL");
    events = eventCount.toLocaleString("he-IL");
    orders = orderCount.toLocaleString("he-IL");
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת הנתונים נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground sm:text-4xl">לוח בקרה</h1>
        <p className="mt-2 text-base text-muted">מבט כללי על בתי העסק, האירועים וההזמנות.</p>
      </header>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="בתי עסק פעילים" value={activeStores} />
        <StatCard label="בתי עסק לא פעילים" value={inactiveStores} />
        <StatCard label="אירועים" value={events} />
        <StatCard label="הזמנות" value={orders} />
      </section>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/admin/stores"
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover sm:w-auto"
        >
          ניהול בתי העסק
        </Link>
        <Link
          href="/admin/settings"
          className="inline-flex h-12 w-full items-center justify-center rounded-full border border-brand px-6 text-base font-semibold text-brand transition-colors hover:bg-brand-soft sm:w-auto"
        >
          הגדרות
        </Link>
      </div>
    </main>
  );
}
