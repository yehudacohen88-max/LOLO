"use client";

import { useState } from "react";

export default function VoucherShareActions({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="no-print flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-brand px-5 text-base font-semibold text-white hover:bg-brand-hover"
      >
        הדפסה
      </button>
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-brand px-5 text-base font-semibold text-brand hover:bg-brand-soft"
      >
        {copied ? "הקישור הועתק" : "העתקת קישור"}
      </button>
    </div>
  );
}
