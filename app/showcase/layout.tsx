import type { ReactNode } from "react";
import { Heebo } from "next/font/google";
import styles from "../e/[slug]/flagship.module.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-premium-heebo",
  display: "swap",
});

export default function ShowcaseLayout({ children }: { children: ReactNode }) {
  return <div className={`${styles.root} ${heebo.variable} guest-shell`}>{children}</div>;
}
