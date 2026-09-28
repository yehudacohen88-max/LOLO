"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  formatPrice,
  loadSelectedGifts,
  saveSelectedGiftIds,
  type Gift,
} from "@/lib/gifts";
import { useIsClient } from "@/lib/use-is-client";

export default function OrganizeGifts() {
  const router = useRouter();
  const isClient = useIsClient();
  const [selectedGifts, setSelectedGifts] = useState<Gift[]>([]);
  const [ready, setReady] = useState(false);

  if (isClient && !ready) {
    setSelectedGifts(loadSelectedGifts());
    setReady(true);
  }

  function moveGift(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedGifts.length) {
      return;
    }

    const next = [...selectedGifts];
    const [gift] = next.splice(index, 1);
    next.splice(nextIndex, 0, gift);
    setSelectedGifts(next);
    saveSelectedGiftIds(next.map((item) => item.id));
  }

  function continueToDetails() {
    saveSelectedGiftIds(selectedGifts.map((gift) => gift.id));
    router.push("/create-event/details");
  }

  if (!ready) {
    return null;
  }

  if (selectedGifts.length === 0) {
    return (
      <div className="mt-10 rounded-3xl border border-border bg-white p-6 text-center">
        <p className="text-base text-muted">עדיין לא נבחרו מתנות.</p>
        <Link
          href="/create-event/gifts/catalog"
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          חזרה לקטלוג
        </Link>
      </div>
    );
  }

  return (
    <>
      <ol className="mt-10 flex flex-col gap-3">
        {selectedGifts.map((gift, index) => (
          <li
            key={gift.id}
            className="flex items-center gap-3 rounded-3xl border border-border bg-white p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground">{gift.name}</p>
              <p className="mt-1 text-sm text-brand">{formatPrice(gift.price)}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={() => moveGift(index, -1)}
                disabled={index === 0}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground disabled:opacity-30"
              >
                למעלה
              </button>
              <button
                type="button"
                onClick={() => moveGift(index, 1)}
                disabled={index === selectedGifts.length - 1}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground disabled:opacity-30"
              >
                למטה
              </button>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={continueToDetails}
        className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        ממשיכים
      </button>
    </>
  );
}
