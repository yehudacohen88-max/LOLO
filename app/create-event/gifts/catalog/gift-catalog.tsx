"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  formatPrice,
  giftCategories,
  gifts,
  saveSelectedGiftIds,
  loadSelectedGiftIds,
  type GiftCategory,
} from "@/lib/gifts";
import { useIsClient } from "@/lib/use-is-client";

export default function GiftCatalog() {
  const router = useRouter();
  const isClient = useIsClient();
  const [category, setCategory] = useState<GiftCategory>("הכל");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  if (isClient && !ready) {
    setSelectedIds(loadSelectedGiftIds());
    setReady(true);
  }

  const visibleGifts = useMemo(
    () =>
      category === "הכל"
        ? gifts
        : gifts.filter((gift) => gift.category === category),
    [category],
  );

  function toggleGift(id: string) {
    setSelectedIds((current) => {
      const next = current.includes(id)
        ? current.filter((giftId) => giftId !== id)
        : [...current, id];
      saveSelectedGiftIds(next);
      return next;
    });
  }

  function continueToOrganize() {
    if (selectedIds.length === 0) {
      return;
    }

    saveSelectedGiftIds(selectedIds);
    router.push("/create-event/gifts/organize");
  }

  return (
    <>
      <div className="flex flex-1 flex-col px-5 pb-36 pt-10 sm:px-8 sm:pt-16">
        <header className="flex flex-col items-center text-center">
          <Link
            href="/"
            className="text-4xl font-extrabold tracking-[0.28em] text-brand sm:text-5xl"
          >
            LOLO
          </Link>
          <p className="mt-5 text-sm font-medium text-brand">שלב 2 מתוך 4</p>
          <h1 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            בוחרים את המתנות שלכם
          </h1>
          <p className="mt-3 max-w-md text-base leading-relaxed text-muted sm:text-lg">
            מה באמת הייתם שמחים לקבל?
            <br />
            בחרו כמה מתנות ואנחנו נדאג להמשך.
          </p>
        </header>

        <div className="mt-8 -mx-5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
          <div className="flex w-max gap-2 pb-1">
            {giftCategories.map((item) => {
              const isActive = category === item;

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-brand text-white"
                      : "border border-border bg-white text-foreground hover:bg-brand-soft"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {visibleGifts.map((gift) => {
            const selected = selectedIds.includes(gift.id);

            return (
              <li key={gift.id}>
                <button
                  type="button"
                  onClick={() => toggleGift(gift.id)}
                  aria-pressed={selected}
                  className={`flex w-full items-start gap-3 rounded-3xl border p-4 text-right transition-colors ${
                    selected
                      ? "border-brand bg-brand-soft"
                      : "border-border bg-white hover:bg-brand-soft/50"
                  }`}
                >
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl"
                    aria-hidden
                  >
                    {gift.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-bold text-foreground">
                        {gift.name}
                      </h2>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          selected
                            ? "bg-brand text-white"
                            : "border border-border bg-white text-transparent"
                        }`}
                        aria-hidden
                      >
                        ✓
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {gift.description}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-brand">
                      {formatPrice(gift.price)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-white/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <p className="text-center text-sm font-medium text-muted">
            נבחרו {selectedIds.length} מתנות
          </p>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={continueToOrganize}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand/40 disabled:hover:bg-brand/40"
          >
            ממשיכים לסידור המתנות
          </button>
        </div>
      </div>
    </>
  );
}
