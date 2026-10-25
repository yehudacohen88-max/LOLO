import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Heebo } from "next/font/google";
import styles from "./flagship.module.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-premium-heebo",
  display: "swap",
});

export default function GuestFlowLayout({ children }: { children: ReactNode }) {
  return <div className={`${styles.root} ${heebo.variable}`}>{children}</div>;
}
