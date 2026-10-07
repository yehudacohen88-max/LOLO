import type { ReactNode } from "react";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin/session";
import AdminNav from "./admin-nav";
import LogoutButton from "./logout-button";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-4 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/admin" className="text-2xl font-extrabold tracking-[0.22em] text-brand">
              LOLO
            </Link>
            {session ? <LogoutButton /> : <p className="text-sm font-semibold text-muted">ניהול פנימי</p>}
          </div>
          {session ? <AdminNav /> : null}
        </div>
      </header>
      {children}
    </div>
  );
}
