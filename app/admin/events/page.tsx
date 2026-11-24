import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listDeskEvents } from "@/lib/desk/directory";
import { deskDb } from "@/lib/desk/http";
import { getAdminSession } from "@/lib/admin/session";
import { formatVoucherWhen } from "@/lib/vouchers/labels";

export const metadata: Metadata = {
  title: "אירועים ומארחים | LOLO",
};

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function AdminEventsPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }
  const params = await searchParams;
  const q = params.q ?? "";
  let events: Awaited<ReturnType<typeof listDeskEvents>> = [];
  let loadError = "";
  try {
    events = await listDeskEvents(deskDb(), q);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת האירועים נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-4xl">אירועים ומארחים</h1>
        <p className="mt-2 text-base text-muted">
          רשימת האירועים לפי שם המארח. אין כאן קוד כניסה של מארח.
        </p>
      </header>
      <form className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
        <label className="flex flex-1 flex-col gap-2 text-sm font-semibold">
          חיפוש
          <input
            name="q"
            defaultValue={q}
            className="h-12 rounded-2xl border border-border bg-white px-4 font-normal"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
        >
          סינון
        </button>
      </form>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {!loadError && events.length === 0 ? (
        <p className="mt-8 text-base text-muted">אין אירועים להצגה.</p>
      ) : null}
      <ul className="mt-6 flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-3xl border border-border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">{event.title || "אירוע"}</p>
                <p className="mt-1 text-sm text-muted">מארח: {event.hostName || "לא צוין"}</p>
              </div>
              <p className="text-sm text-muted">{event.eventDate}</p>
            </div>
            <p className="mt-2 text-sm text-muted">
              {event.venueName} · {formatVoucherWhen(event.createdAt)}
            </p>
            <Link href={`/admin/events/${event.id}`} className="mt-3 inline-flex text-sm font-semibold text-brand">
              לפתיחה
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
