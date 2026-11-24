import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { listDeskOrders, orderDemoText, paymentStatusLabel } from "@/lib/desk/directory";
import { deskDb } from "@/lib/desk/http";
import { formatGiftAmount } from "@/lib/guest-draft";
import { formatVoucherWhen } from "@/lib/vouchers/labels";

export const metadata: Metadata = { title: "הזמנות | LOLO" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ status?: string }> };

const STATUSES = ["", "pending", "paid", "failed", "cancelled"] as const;

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }
  const params = await searchParams;
  const status = STATUSES.find((item) => item === params.status) ?? "";
  let orders: Awaited<ReturnType<typeof listDeskOrders>>["orders"] = [];
  let loadError = "";
  try {
    orders = (await listDeskOrders(deskDb(), status || undefined)).orders;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת ההזמנות נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-4xl">הזמנות</h1>
        <p className="mt-2 text-base text-muted">קריאה בלבד. אין כאן גבייה, ביטול או החזר.</p>
      </header>
      <form className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
        <label className="flex flex-1 flex-col gap-2 text-sm font-semibold">
          סטטוס
          <select
            name="status"
            defaultValue={status}
            className="h-12 rounded-2xl border border-border bg-white px-4 font-normal"
          >
            <option value="">הכול</option>
            <option value="pending">ממתין</option>
            <option value="paid">שולם</option>
            <option value="failed">נכשל</option>
            <option value="cancelled">בוטל</option>
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
        >
          סינון
        </button>
      </form>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {!loadError && orders.length === 0 ? <p className="mt-8 text-base text-muted">אין הזמנות להצגה.</p> : null}
      <ul className="mt-6 flex flex-col gap-3">
        {orders.map((order) => (
          <li key={order.id} className="rounded-3xl border border-border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">{order.guestName || "אורח"}</p>
                <p className="mt-1 text-sm text-muted">{order.eventSlug}</p>
              </div>
              <p className="text-xl font-bold">{formatGiftAmount(order.totalAmount)}</p>
            </div>
            <p className="mt-3 text-sm text-muted">
              {paymentStatusLabel(order.paymentStatus)} · {orderDemoText(order)} ·{" "}
              {formatVoucherWhen(order.createdAt)}
            </p>
            <Link href={`/admin/orders/${order.id}`} className="mt-3 inline-flex text-sm font-semibold text-brand">
              לפתיחה
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
