import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { LegalFrame } from "@/components/legal/document-view";
import { LEGAL_DOCUMENTS, legalSurface } from "@/lib/legal/documents";
import { legalDraftsEnabledFromEnv } from "@/lib/legal/flag";

export async function generateMetadata(): Promise<Metadata> {
  const visible = legalSurface(legalDraftsEnabledFromEnv()) === "index";
  if (visible) {
    await connection();
  }
  return {
    title: visible ? "טיוטות משפטיות | LOLO" : "LOLO",
    robots: { index: false, follow: false },
  };
}

export default async function LegalIndexPage() {
  const surface = legalSurface(legalDraftsEnabledFromEnv());
  if (surface !== "index") {
    notFound();
  }
  await connection();

  return (
    <LegalFrame
      title="טיוטות משפטיות"
      lede="העמודים האלה אינם בתפריט הציבורי. הם נפתחים רק כשהדגל דולק."
    >
      <ul className="flex flex-col gap-4">
        {LEGAL_DOCUMENTS.map((doc) => (
          <li key={doc.slug} className="rounded-2xl border border-border bg-white p-4">
            <p className="text-base font-bold text-foreground">{doc.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{doc.summary}</p>
          </li>
        ))}
      </ul>
    </LegalFrame>
  );
}
