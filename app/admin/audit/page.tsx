import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { listAuditEvents } from "@/lib/desk/audit-adapter";
import { deskDb } from "@/lib/desk/http";
import { formatVoucherWhen } from "@/lib/vouchers/labels";

export const metadata: Metadata = { title: "יומן פעולות | LOLO" };
export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  let loadError = "";
  let page: Awaited<ReturnType<typeof listAuditEvents>> | null = null;
  try {
    page = await listAuditEvents(deskDb());
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת היומן נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-4xl">יומן פעולות</h1>
        <p className="mt-2 text-base text-muted">רשומות שנוספו ליומן. אי אפשר לערוך או למחוק אותן מכאן.</p>
      </header>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {page && !page.available ? <p className="mt-6 text-sm text-brand">{page.message}</p> : null}
      {page?.available && page.rows.length === 0 ? (
        <p className="mt-8 text-base text-muted">אין רשומות להצגה.</p>
      ) : null}
      <ul className="mt-6 flex flex-col gap-3">
        {page?.rows.map((row) => (
          <li key={row.id} className="rounded-3xl border border-border bg-white p-5 text-sm">
            <p className="font-bold">{row.action}</p>
            <p className="mt-2 text-muted">
              {row.actor} · {row.subject || "—"} · {formatVoucherWhen(row.at)}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
