import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Heebo } from "next/font/google";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-preview-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "הדמיה — דף הבית | LOLO",
  robots: { index: false, follow: false },
};

export default function DesignPreviewLayout({ children }: { children: ReactNode }) {
  return <div className={heebo.variable}>{children}</div>;
}
