import type { ReactNode } from "react";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin/session";
import LogoutButton from "./logout-button";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link
            href="/admin"
            className="text-2xl font-extrabold tracking-[0.22em] text-brand"
          >
            LOLO
          </Link>
          {session ? (
            <nav className="flex items-center gap-4">
              <Link href="/admin" className="text-sm font-semibold text-foreground">
                לוח בקרה
              </Link>
              <Link
                href="/admin/stores"
                className="text-sm font-semibold text-foreground"
              >
                בתי עסק
              </Link>
              <LogoutButton />
            </nav>
          ) : (
            <p className="text-sm font-semibold text-muted">ניהול פנימי</p>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
