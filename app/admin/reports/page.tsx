import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { settlementsEnabled } from "@/lib/settlements/availability";

export const metadata: Metadata = { title: "דוחות | LOLO" };
export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin/settlements/report", label: "דוח התחשבנות", hint: "יתרות, עמלה, ומימושי הדגמה מחוץ לתשלום." },
  { href: "/admin/settlements/reconciliation", label: "התאמה", hint: "צפוי מול מה שסומן כשולם." },
  { href: "/admin/settlements", label: "התחשבנויות", hint: "אצוות לבתי העסק." },
  { href: "/api/admin/settlements/report", label: "CSV", hint: "אותו דוח כקובץ." },
];

export default async function AdminReportsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }
  const open = settlementsEnabled();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-4xl">דוחות</h1>
        <p className="mt-2 max-w-3xl text-base text-muted">
          הדוחות הקיימים של ההתחשבנות. המסך הזה לא מחשב עמלה מחדש.
        </p>
      </header>
      {open ? (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {LINKS.map((link) => (
            <li key={link.href} className="rounded-3xl border border-border bg-white p-5">
              {link.href.startsWith("/api/") ? (
                <a href={link.href} className="text-lg font-bold text-brand">
                  {link.label}
                </a>
              ) : (
                <Link href={link.href} className="text-lg font-bold text-brand">
                  {link.label}
                </Link>
              )}
              <p className="mt-2 text-sm text-muted">{link.hint}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-base text-muted">דוחות ההתחשבנות סגורים בפיילוט.</p>
      )}
    </main>
  );
}
