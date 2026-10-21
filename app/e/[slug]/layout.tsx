import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Frank_Ruhl_Libre, Rubik } from "next/font/google";
import styles from "./flagship.module.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-flagship-sans",
  display: "swap",
});

const frankRuhl = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-flagship-serif",
  display: "swap",
});

export default function GuestFlowLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.root} ${rubik.variable} ${frankRuhl.variable}`}>{children}</div>
  );
}
