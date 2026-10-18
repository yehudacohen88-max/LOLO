import type { Metadata } from "next";
import { Frank_Ruhl_Libre, Rubik } from "next/font/google";
import GuestEventView from "./guest-event-view";
import styles from "./flagship.module.css";

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

export const metadata: Metadata = {
  title: "האירוע | LOLO",
};

export default function GuestEventPage() {
  return (
    <div className={`${styles.root} ${rubik.variable} ${frankRuhl.variable}`}>
      <GuestEventView />
    </div>
  );
}
