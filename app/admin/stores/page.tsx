import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import {
  commissionLabel,
  paymentTermsLabel,
  settlementLabel,
} from "@/lib/admin/store-fields";
import { listAdminStores } from "@/lib/admin/stores";
import StoreStatusButton from "./store-status-button";

export const metadata: Metadata = {
  title: "בתי עסק | LOLO",
};

export const dynamic = "force-dynamic";

export default async function AdminStoresPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  let stores: Awaited<ReturnType<typeof listAdminStores>> = [];
  let loadError = "";
  try {
    stores = await listAdminStores();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת בתי העסק נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-4xl">בתי עסק</h1>
          <p className="mt-2 text-base text-muted">חנויות שבעלי אירועים יכולים לשייך למתנות.</p>
        </div>
        <Link
          href="/admin/stores/new"
          className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          הוספת בית עסק
        </Link>
      </header>

      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}

      {!loadError && stores.length === 0 ? (
        <p className="mt-8 text-base text-muted">אין עדיין בתי עסק.</p>
      ) : null}

      {stores.length > 0 ? (
        <ul className="mt-8 flex flex-col gap-3 md:hidden">
          {stores.map((store) => (
            <li key={store.id} className="rounded-3xl border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-foreground">{store.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {store.active ? "פעיל" : "לא פעיל"}
                    {" · "}
                    עמלה {commissionLabel(store.commissionPercent)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {paymentTermsLabel(store.paymentTermsDays)}
                    {" · "}
                    {settlementLabel(store.settlementMethod)}
                  </p>
                </div>
                <Link href={`/admin/stores/${store.id}`} className="shrink-0 text-sm font-semibold text-brand">
                  עריכה
                </Link>
              </div>
              <div className="mt-3">
                <StoreStatusButton storeId={store.id} active={store.active} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {stores.length > 0 ? (
        <div className="mt-8 hidden overflow-x-auto rounded-3xl border border-border bg-white md:block">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">שם העסק</th>
                <th className="px-4 py-3 font-semibold">סטטוס</th>
                <th className="px-4 py-3 font-semibold">עמלה</th>
                <th className="px-4 py-3 font-semibold">תנאי תשלום</th>
                <th className="px-4 py-3 font-semibold">אופן התחשבנות</th>
                <th className="px-4 py-3 font-semibold">עריכה</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-4 font-semibold text-foreground">{store.name}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      <span className={store.active ? "text-foreground" : "text-muted"}>
                        {store.active ? "פעיל" : "לא פעיל"}
                      </span>
                      <StoreStatusButton storeId={store.id} active={store.active} />
                    </div>
                  </td>
                  <td className="px-4 py-4">{commissionLabel(store.commissionPercent)}</td>
                  <td className="px-4 py-4">{paymentTermsLabel(store.paymentTermsDays)}</td>
                  <td className="px-4 py-4">{settlementLabel(store.settlementMethod)}</td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/admin/stores/${store.id}`}
                      className="font-semibold text-brand hover:text-brand-hover"
                    >
                      עריכה
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
