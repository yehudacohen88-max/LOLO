"use client";

import { useState } from "react";

type CopyGuestLinkProps = {
  guestUrl: string;
};

export default function CopyGuestLink({ guestUrl }: CopyGuestLinkProps) {
  const [toast, setToast] = useState("");

  async function copyLink() {
    if (!guestUrl) {
      return;
    }

    await navigator.clipboard.writeText(guestUrl);
    setToast("הקישור הועתק");
    window.setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className="flex flex-col gap-3">
      {toast ? (
        <p className="rounded-2xl bg-brand-soft px-4 py-3 text-center text-sm font-medium text-brand">
          {toast}
        </p>
      ) : null}
      <p
        dir="ltr"
        className="break-all rounded-2xl bg-brand-soft px-4 py-3 text-center text-sm font-medium text-foreground"
      >
        {guestUrl}
      </p>
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover sm:w-auto"
      >
        העתקת קישור
      </button>
    </div>
  );
}
