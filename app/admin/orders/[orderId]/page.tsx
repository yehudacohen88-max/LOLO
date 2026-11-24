import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import NotesForm from "@/app/admin/notes-form";
import { getAdminSession } from "@/lib/admin/session";
import {
  getDeskOrder,
  listOrderItems,
  orderDemoText,
  paymentStatusLabel,
} from "@/lib/desk/directory";
import { deskDb } from "@/lib/desk/http";
import { listOrderNotificationLog } from "@/lib/desk/notifications-adapter";
import { listSupportNotes } from "@/lib/desk/notes";
import { listPaymentAttempts, listPaymentRefunds, paymentDemoLabel } from "@/lib/desk/payments-adapter";
import { formatGiftAmount } from "@/lib/guest-draft";
import { formatVoucherWhen } from "@/lib/vouchers/labels";
import { isUuid } from "@/lib/vouchers/input";

export const metadata: Metadata = { title: "הזמנה | LOLO" };
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ orderId: string }> };

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }
  const { orderId } = await params;
  if (!isUuid(orderId)) {
    notFound();
  }

  let loadError = "";
  let order = null;
  let items: Awaited<ReturnType<typeof listOrderItems>> = [];
  let notes: Awaited<ReturnType<typeof listSupportNotes>> = { available: false, message: "", notes: [] };
  let attempts: Awaited<ReturnType<typeof listPaymentAttempts>> | null = null;
  let refunds: Awaited<ReturnType<typeof listPaymentRefunds>> | null = null;
  let notifications: Awaited<ReturnType<typeof listOrderNotificationLog>> | null = null;

  try {
    const db = deskDb();
    order = await getDeskOrder(orderId, db);
    if (order) {
      [items, notes, attempts, refunds, notifications] = await Promise.all([
        listOrderItems(orderId, db),
        listSupportNotes("order", orderId, db),
        listPaymentAttempts(db, orderId),
        listPaymentRefunds(db, orderId),
        listOrderNotificationLog(orderId, db),
      ]);
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת ההזמנה נכשלה.";
  }
  if (!loadError && !order) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <Link href="/admin/orders" className="text-sm font-semibold text-brand">
        לכל ההזמנות
      </Link>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {order ? (
        <>
          <header className="mt-4">
            <h1 className="text-2xl font-bold sm:text-4xl">{order.guestName || "אורח"}</h1>
            <p className="mt-2 text-base text-muted">
              {paymentStatusLabel(order.paymentStatus)} · {orderDemoText(order)}
            </p>
          </header>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
            המסך לקריאה. אין כאן גבייה או החזר. ביטול והחזר של תשלום הדגמה נשארים במסלול התשלומים
            כשהוא מופעל.
          </p>
          <section className="mt-6 rounded-3xl border border-border bg-white p-5 text-sm">
            <p>טלפון: {order.guestPhone || "—"}</p>
            <p className="mt-2">אימייל: {order.guestEmail || "—"}</p>
            <p className="mt-2">אירוע: {order.eventSlug}</p>
            <p className="mt-2">סכום מתנות: {formatGiftAmount(order.totalAmount)}</p>
            {order.feeAmount != null ? <p className="mt-2">דמי שירות: {formatGiftAmount(order.feeAmount)}</p> : null}
            {order.chargedAmount != null ? (
              <p className="mt-2">סכום לחיוב: {formatGiftAmount(order.chargedAmount)}</p>
            ) : null}
            {order.greetingText ? <p className="mt-4 leading-relaxed">{order.greetingText}</p> : null}
            <Link href={`/admin/events/${order.eventId}`} className="mt-4 inline-flex font-semibold text-brand">
              לאירוע
            </Link>
          </section>
          <section className="mt-8">
            <h2 className="text-lg font-bold">מתנות בהזמנה</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.id} className="rounded-3xl border border-border bg-white p-5">
                  <p className="font-bold">{item.giftName}</p>
                  <p className="mt-1">{formatGiftAmount(item.amount)}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-8">
            <h2 className="text-lg font-bold">ניסיונות תשלום</h2>
            {attempts && !attempts.available ? <p className="mt-3 text-sm text-brand">{attempts.message}</p> : null}
            <ul className="mt-3 flex flex-col gap-3">
              {attempts?.rows.map((row) => (
                <li key={row.id} className="rounded-3xl border border-border bg-white p-5 text-sm">
                  <p className="font-bold">
                    {row.status} · {paymentDemoLabel(row.simulated)}
                  </p>
                  <p className="mt-2 text-muted">
                    {formatGiftAmount(row.amount)} · {formatVoucherWhen(row.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-8">
            <h2 className="text-lg font-bold">החזרים</h2>
            {refunds && !refunds.available ? <p className="mt-3 text-sm text-brand">{refunds.message}</p> : null}
            <ul className="mt-3 flex flex-col gap-3">
              {refunds?.rows.map((row) => (
                <li key={row.id} className="rounded-3xl border border-border bg-white p-5 text-sm">
                  <p className="font-bold">
                    {row.status} · {paymentDemoLabel(row.simulated)}
                  </p>
                  <p className="mt-2 text-muted">{formatGiftAmount(row.amount)}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-8">
            <h2 className="text-lg font-bold">הודעות</h2>
            {notifications && !notifications.available ? (
              <p className="mt-3 text-sm text-brand">{notifications.message}</p>
            ) : null}
            <ul className="mt-3 flex flex-col gap-3">
              {notifications?.rows.map((row) => (
                <li key={row.id} className="rounded-3xl border border-border bg-white p-5 text-sm">
                  <p className="font-bold">
                    {row.channel} · {row.status}
                  </p>
                  <p className="mt-2 text-muted">{row.subject}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-8 rounded-3xl border border-border bg-white p-5">
            <h2 className="text-lg font-bold">הערות תמיכה</h2>
            {!notes.available ? <p className="mt-3 text-sm text-brand">{notes.message}</p> : null}
            <ul className="mt-4 flex flex-col gap-3">
              {notes.notes.map((note) => (
                <li key={note.id} className="rounded-2xl bg-brand-soft px-4 py-3 text-sm">
                  <p>{note.body}</p>
                  <p className="mt-2 text-muted">{formatVoucherWhen(note.createdAt)}</p>
                </li>
              ))}
            </ul>
            <NotesForm subjectKind="order" subjectId={order.id} />
          </section>
        </>
      ) : null}
    </main>
  );
}
