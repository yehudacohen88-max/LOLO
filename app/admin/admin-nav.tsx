"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "לוח בקרה", exact: true },
  { href: "/admin/stores", label: "בתי עסק", exact: false },
  { href: "/admin/events", label: "אירועים", exact: false },
  { href: "/admin/orders", label: "הזמנות", exact: false },
  { href: "/admin/guests", label: "אורחים", exact: false },
  { href: "/admin/vouchers", label: "שוברים", exact: false },
  { href: "/admin/redemptions", label: "מימושים", exact: false },
  { href: "/admin/payments", label: "תשלומים", exact: false },
  { href: "/admin/refunds", label: "החזרים", exact: false },
  { href: "/admin/reports", label: "דוחות", exact: false },
  { href: "/admin/audit", label: "יומן", exact: false },
  { href: "/admin/settlements", label: "התחשבנויות", exact: false },
  { href: "/admin/settings", label: "הגדרות", exact: false },
  { href: "/admin/notifications", label: "הודעות", exact: false },
];

export default function AdminNav({ showSettlements = false }: { showSettlements?: boolean }) {
  const pathname = usePathname();
  const links = LINKS.filter(
    (link) => showSettlements || link.href !== "/admin/settlements",
  );

  return (
    <nav className="flex gap-2 overflow-x-auto pb-1">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
              active ? "bg-brand text-white" : "bg-brand-soft text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
