import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { listDeskGuests } from "@/lib/desk/directory";
import { deskDb } from "@/lib/desk/http";
import { formatVoucherWhen } from "@/lib/vouchers/labels";
import { isUuid } from "@/lib/vouchers/input";

export const metadata: Metadata = { title: "אורחים | LOLO" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ event?: string }> };

export default async function AdminGuestsPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }
  const params = await searchParams;
  const eventId = params.event && isUuid(params.event) ? params.event : "";
  let guests: Awaited<ReturnType<typeof listDeskGuests>> = [];
  let loadError = "";
  try {
    guests = await listDeskGuests(deskDb(), eventId || undefined);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת האורחים נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-4xl">אורחים</h1>
        <p className="mt-2 text-base text-muted">שם וטלפון בלבד. אסימון ההזמנה לא מוצג.</p>
      </header>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {!loadError && guests.length === 0 ? <p className="mt-8 text-base text-muted">אין אורחים להצגה.</p> : null}
      <ul className="mt-6 flex flex-col gap-3">
        {guests.map((guest) => (
          <li key={guest.id} className="rounded-3xl border border-border bg-white p-5">
            <p className="font-bold">{guest.name}</p>
            <p className="mt-1 text-sm text-muted">{guest.phone}</p>
            <p className="mt-2 text-sm text-muted">{formatVoucherWhen(guest.createdAt)}</p>
            <Link
              href={`/admin/events/${guest.eventId}`}
              className="mt-3 inline-flex text-sm font-semibold text-brand"
            >
              לאירוע
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
