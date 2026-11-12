import Link from "next/link";
import type { ReactNode } from "react";
import { Heebo } from "next/font/google";
import LoloMark from "@/app/design/lolo-mark";
import home from "@/app/design/premium-home.module.css";
import { guestPreviewPaths } from "@/app/design/guest-premium-sample";
import styles from "@/app/design/guest-premium.module.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-premium-heebo",
  display: "swap",
});

const screens = [
  ["האירוע", guestPreviewPaths.event],
  ["ברכה", guestPreviewPaths.greeting],
  ["פרטים", guestPreviewPaths.details],
  ["תשלום", guestPreviewPaths.payment],
  ["תודה", guestPreviewPaths.thanks],
  ["קישור לא פעיל", guestPreviewPaths.missing],
] as const;

export default function GuestPremiumShell({
  current,
  children,
}: {
  current: (typeof screens)[number][1];
  children: ReactNode;
}) {
  return (
    <div className={`${home.page} ${heebo.variable}`}>
      <p className={home.simLabel}>הדמיה — לא באתר החי</p>
      <main className={styles.main}>
        <p className={`${home.brand} ${styles.brand}`}>
          <LoloMark />
        </p>
        {children}
        <nav className={styles.screens} aria-label="מסכי ההדמיה">
          {screens.map(([label, href]) => (
            <Link key={href} href={href} aria-current={href === current ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
