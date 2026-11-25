import type { ReactNode } from "react";
import Link from "next/link";
import {
  LEGAL_DOCUMENTS,
  LEGAL_DRAFT_BANNER,
  type LegalDocument,
} from "@/lib/legal/documents";
import { BUSINESS_DECISION, LEGAL_REVIEW } from "@/lib/legal/markers";

function isWarning(text: string) {
  return text.startsWith(BUSINESS_DECISION) || text.startsWith(LEGAL_REVIEW);
}

export function LegalFrame({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:py-12">
      <p className="rounded-2xl border border-border bg-brand-soft p-4 text-sm leading-relaxed">
        {LEGAL_DRAFT_BANNER}
      </p>
      <h1 className="mt-6 text-3xl font-bold text-foreground">{title}</h1>
      {lede ? <p className="mt-3 text-base leading-relaxed text-muted">{lede}</p> : null}
      <nav className="mt-6 flex flex-col gap-2 text-sm" aria-label="טיוטות">
        {LEGAL_DOCUMENTS.map((item) => (
          <Link key={item.slug} href={`/legal/${item.slug}`} className="font-semibold text-brand underline">
            {item.title}
          </Link>
        ))}
      </nav>
      <div className="mt-8 flex flex-col gap-4">{children}</div>
    </main>
  );
}

export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  return (
    <LegalFrame title={doc.title} lede={doc.summary}>
      {doc.blocks.map((block, index) => {
        if (block.type === "h2") {
          return (
            <h2 key={index} className="mt-4 text-xl font-bold text-foreground">
              {block.text}
            </h2>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={index} className="flex list-disc flex-col gap-2 pe-5 text-sm leading-relaxed">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "links") {
          return (
            <ul key={index} className="flex flex-col gap-2 text-sm">
              {block.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="font-semibold text-brand underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "callout" || isWarning(block.text)) {
          return (
            <p
              key={index}
              className="rounded-2xl border border-border bg-white p-4 text-sm leading-relaxed"
              data-legal-warning=""
            >
              {block.text}
            </p>
          );
        }
        return (
          <p key={index} className="text-sm leading-relaxed text-foreground">
            {block.text}
          </p>
        );
      })}
    </LegalFrame>
  );
}
