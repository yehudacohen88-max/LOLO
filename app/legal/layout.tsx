import type { ReactNode } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { legalDraftsEnabledFromEnv } from "@/lib/legal/flag";

export const metadata: Metadata = {
  title: "LOLO",
  robots: { index: false, follow: false },
};

export default async function LegalLayout({ children }: { children: ReactNode }) {
  if (!legalDraftsEnabledFromEnv()) {
    notFound();
  }
  await connection();
  return children;
}
