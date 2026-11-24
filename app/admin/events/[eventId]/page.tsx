import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import NotesForm from "@/app/admin/notes-form";
import { getAdminSession } from "@/lib/admin/session";
import { getDeskEvent, listDeskGuests, listEventGifts } from "@/lib/desk/directory";
import { deskDb } from "@/lib/desk/http";
import { listSupportNotes } from "@/lib/desk/notes";
import { formatGiftAmount } from "@/lib/guest-draft";
import { formatVoucherWhen } from "@/lib/vouchers/labels";
import { isUuid } from "@/lib/vouchers/input";

export const metadata: Metadata = { title: "אירוע | LOLO" };
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ eventId: string }> };

export default async function AdminEventDetailPage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }
  const { eventId } = await params;
  if (!isUuid(eventId)) {
    notFound();
  }

  let loadError = "";
  let event = null;
  let gifts: Awaited<ReturnType<typeof listEventGifts>> = [];
  let guests: Awaited<ReturnType<typeof listDeskGuests>> = [];
  let notes: Awaited<ReturnType<typeof listSupportNotes>> = {
    available: false,
    message: "",
    notes: [],
  };
  try {
    const db = deskDb();
    event = await getDeskEvent(eventId, db);
    if (event) {
      [gifts, guests, notes] = await Promise.all([
        listEventGifts(eventId, db),
        listDeskGuests(db, eventId),
        listSupportNotes("event", eventId, db),
      ]);
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת האירוע נכשלה.";
  }
  if (!loadError && !event) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <Link href="/admin/events" className="text-sm font-semibold text-brand">
        לכל האירועים
      </Link>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {event ? (
        <>
          <header className="mt-4">
            <h1 className="text-2xl font-bold sm:text-4xl">{event.title || "אירוע"}</h1>
            <p className="mt-2 text-base text-muted">
              מארח: {event.hostName || "לא צוין"} · {event.eventDate} {event.eventTime}
            </p>
            <p className="mt-1 text-sm text-muted">
              {event.venueName} {event.address}
            </p>
          </header>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href={`/admin/orders?event=${event.id}`} className="text-sm font-semibold text-brand">
              הזמנות
            </Link>
            <Link href={`/admin/guests?event=${event.id}`} className="text-sm font-semibold text-brand">
              אורחים
            </Link>
          </div>
          {event.message ? <p className="mt-6 max-w-3xl text-sm leading-relaxed">{event.message}</p> : null}
          <section className="mt-8">
            <h2 className="text-lg font-bold">מתנות</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {gifts.map((gift) => (
                <li key={gift.id} className="rounded-3xl border border-border bg-white p-5">
                  <p className="font-bold">{gift.title || "מתנה"}</p>
                  <p className="mt-1 text-sm text-muted">{formatGiftAmount(gift.targetAmount)}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-8">
            <h2 className="text-lg font-bold">אורחים שהוזמנו</h2>
            <p className="mt-2 text-sm text-muted">{guests.length.toLocaleString("he-IL")} רשומות. בלי אסימון הזמנה.</p>
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
            <NotesForm subjectKind="event" subjectId={event.id} />
          </section>
        </>
      ) : null}
    </main>
  );
}
