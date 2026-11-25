import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { listDeskOrders, orderDemoText, paymentStatusLabel } from "@/lib/desk/directory";
import { deskDb } from "@/lib/desk/http";
import { listPaymentAttempts, paymentDemoLabel } from "@/lib/desk/payments-adapter";
import { formatGiftAmount } from "@/lib/guest-draft";
import { formatVoucherWhen } from "@/lib/vouchers/labels";

export const metadata: Metadata = { title: "תשלומים | LOLO" };
export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  let loadError = "";
  let orders: Awaited<ReturnType<typeof listDeskOrders>>["orders"] = [];
  let attempts: Awaited<ReturnType<typeof listPaymentAttempts>> | null = null;
  try {
    const db = deskDb();
    [orders, attempts] = await Promise.all([
      listDeskOrders(db).then((page) => page.orders),
      listPaymentAttempts(db),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת התשלומים נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-4xl">תשלומים</h1>
        <p className="mt-2 max-w-3xl text-base text-muted">
          קריאה בלבד. אין כאן גבייה. תשלום הדגמה מסומן, ואינו נחשב לכסף אמיתי.
        </p>
      </header>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      <section className="mt-8">
        <h2 className="text-lg font-bold">יומן ניסיונות</h2>
        {attempts && !attempts.available ? <p className="mt-3 text-sm text-brand">{attempts.message}</p> : null}
        <ul className="mt-4 flex flex-col gap-3">
          {attempts?.rows.map((row) => (
            <li key={row.id} className="rounded-3xl border border-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-bold">
                  {row.status} · {paymentDemoLabel(row.simulated)}
                </p>
                <p className="text-xl font-bold">{formatGiftAmount(row.amount)}</p>
              </div>
              <p className="mt-2 text-sm text-muted">{formatVoucherWhen(row.createdAt)}</p>
              <Link href={`/admin/orders/${row.orderId}`} className="mt-3 inline-flex text-sm font-semibold text-brand">
                להזמנה
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-bold">סטטוס בהזמנות</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded-3xl border border-border bg-white p-5">
              <p className="font-bold">{order.guestName || "אורח"}</p>
              <p className="mt-2 text-sm text-muted">
                {paymentStatusLabel(order.paymentStatus)} · {orderDemoText(order)} ·{" "}
                {formatGiftAmount(order.totalAmount)}
              </p>
              <Link href={`/admin/orders/${order.id}`} className="mt-3 inline-flex text-sm font-semibold text-brand">
                להזמנה
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
