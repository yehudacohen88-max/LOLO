"use client";

import { useId, useState, type ReactNode } from "react";

type MobileDisclosureProps = {
  title: string;
  children: ReactNode;
  id?: string;
  className?: string;
};

export default function MobileDisclosure({
  title,
  children,
  id,
  className = "lolo-card p-4 sm:p-6",
}: MobileDisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section id={id} className={className}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans text-base font-bold text-foreground lg:text-lg">{title}</h2>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-brand lg:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "סגירה" : "פתיחה"}
        </button>
      </div>
      <div id={panelId} className={open ? "mt-3" : "mt-3 max-lg:hidden"}>
        {children}
      </div>
    </section>
  );
}
