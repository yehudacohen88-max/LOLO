import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { listDeskOrders, orderDemoText } from "@/lib/desk/directory";
import { deskDb } from "@/lib/desk/http";
import { listPaymentRefunds, paymentDemoLabel } from "@/lib/desk/payments-adapter";
import { formatGiftAmount } from "@/lib/guest-draft";
import { formatVoucherWhen } from "@/lib/vouchers/labels";

export const metadata: Metadata = { title: "ביטולים והחזרים | LOLO" };
export const dynamic = "force-dynamic";

export default async function AdminRefundsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  let loadError = "";
  let cancelled: Awaited<ReturnType<typeof listDeskOrders>>["orders"] = [];
  let refunds: Awaited<ReturnType<typeof listPaymentRefunds>> | null = null;
  try {
    const db = deskDb();
    [cancelled, refunds] = await Promise.all([
      listDeskOrders(db, "cancelled").then((page) => page.orders),
      listPaymentRefunds(db),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת ההחזרים נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-4xl">ביטולים והחזרים</h1>
        <p className="mt-2 max-w-3xl text-base text-muted">
          קריאה בלבד. ביצוע החזר נשאר במסלול התשלומים, ורק לתשלום הדגמה.
        </p>
      </header>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      <section className="mt-8">
        <h2 className="text-lg font-bold">הזמנות שבוטלו</h2>
        {!loadError && cancelled.length === 0 ? <p className="mt-3 text-sm text-muted">אין ביטולים להצגה.</p> : null}
        <ul className="mt-4 flex flex-col gap-3">
          {cancelled.map((order) => (
            <li key={order.id} className="rounded-3xl border border-border bg-white p-5">
              <p className="font-bold">{order.guestName || "אורח"}</p>
              <p className="mt-2 text-sm text-muted">
                {orderDemoText(order)} · {formatGiftAmount(order.totalAmount)}
              </p>
              <Link href={`/admin/orders/${order.id}`} className="mt-3 inline-flex text-sm font-semibold text-brand">
                להזמנה
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-bold">רישום החזרים</h2>
        {refunds && !refunds.available ? <p className="mt-3 text-sm text-brand">{refunds.message}</p> : null}
        {refunds?.available && refunds.rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">אין החזרים להצגה.</p>
        ) : null}
        <ul className="mt-4 flex flex-col gap-3">
          {refunds?.rows.map((row) => (
            <li key={row.id} className="rounded-3xl border border-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-bold">
                  {row.status} · {paymentDemoLabel(row.simulated)}
                </p>
                <p className="text-xl font-bold">{formatGiftAmount(row.amount)}</p>
              </div>
              <p className="mt-2 text-sm text-muted">
                {formatVoucherWhen(row.createdAt)}
                {row.reason ? ` · ${row.reason}` : ""}
              </p>
              <Link href={`/admin/orders/${row.orderId}`} className="mt-3 inline-flex text-sm font-semibold text-brand">
                להזמנה
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
