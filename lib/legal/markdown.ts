import {
  LEGAL_DRAFT_BANNER,
  LEGAL_DOCUMENTS,
  type LegalBlock,
  type LegalDocument,
} from "@/lib/legal/documents";
import { legalNoticeMarkdown } from "@/lib/legal/notices";

function blockLines(block: LegalBlock) {
  if (block.type === "h2") {
    return [`## ${block.text}`, ""];
  }
  if (block.type === "p" || block.type === "callout") {
    return [block.text, ""];
  }
  if (block.type === "ul") {
    return [...block.items.map((item) => `- ${item}`), ""];
  }
  return [...block.items.map((item) => `- [${item.label}](${item.href})`), ""];
}

export function documentToMarkdown(doc: LegalDocument) {
  const lines = [`# ${doc.title}`, "", LEGAL_DRAFT_BANNER, ""];
  for (const block of doc.blocks) {
    lines.push(...blockLines(block));
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function legalMarkdownFiles() {
  return [
    ...LEGAL_DOCUMENTS.map((doc) => ({
      path: `docs/legal/${doc.file}`,
      body: documentToMarkdown(doc),
    })),
    {
      path: "docs/legal/notices.md",
      body: legalNoticeMarkdown(),
    },
  ];
}
