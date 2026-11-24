import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { LegalDocumentView } from "@/components/legal/document-view";
import { getLegalDocument, legalSurface } from "@/lib/legal/documents";
import { legalDraftsEnabledFromEnv } from "@/lib/legal/flag";

type LegalDocPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LegalDocPageProps): Promise<Metadata> {
  const enabled = legalDraftsEnabledFromEnv();
  if (!enabled) {
    return { title: "LOLO", robots: { index: false, follow: false } };
  }
  await connection();
  const { slug } = await params;
  const doc = legalSurface(enabled, slug) === "document" ? getLegalDocument(slug) : null;
  return {
    title: doc ? `${doc.title} | LOLO` : "LOLO",
    robots: { index: false, follow: false },
  };
}

export default async function LegalDocPage({ params }: LegalDocPageProps) {
  const enabled = legalDraftsEnabledFromEnv();
  if (!enabled) {
    notFound();
  }
  await connection();
  const { slug } = await params;
  if (legalSurface(enabled, slug) !== "document") {
    notFound();
  }
  const doc = getLegalDocument(slug);
  if (!doc) {
    notFound();
  }
  return <LegalDocumentView doc={doc} />;
}
