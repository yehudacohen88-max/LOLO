"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PageHeader from "@/components/page-header";
import { formatPrice, giftCategories, gifts, type GiftCategory } from "@/lib/gifts";

export default function GiftCatalog() {
  const [category, setCategory] = useState<GiftCategory>("הכל");

  const visibleGifts = useMemo(
    () =>
      category === "הכל"
        ? gifts
        : gifts.filter((gift) => gift.category === category),
    [category],
  );

  return (
    <div className="flex flex-1 flex-col px-5 pb-10 pt-10 sm:px-8 sm:pt-16">
      <PageHeader
        step={2}
        total={4}
        title="רעיונות להשראה"
        subtitle="בחרו רעיון ונמלא עבורכם שם, תיאור וסכום מוצע. אחר כך אפשר לשנות הכל, כולל התמונה."
      />

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
        {visibleGifts.map((gift) => (
          <li key={gift.id}>
            <article className="lolo-card flex h-full flex-col overflow-hidden">
              <div
                className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-[#f6e6de] text-5xl"
                aria-hidden
              >
                <span className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 bg-[#c4a574]/70" />
                <span className="absolute left-[14%] right-[14%] top-1/2 h-3 -translate-y-1/2 bg-[#c4a574]/70" />
                <span className="relative">{gift.emoji}</span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="min-w-0 flex-1">
                  <h2 className="font-sans text-base font-bold text-foreground">{gift.name}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {gift.description}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-brand">
                    סכום מוצע {formatPrice(gift.price)}
                  </p>
                </div>
                <Link
                  href={`/create-event/gifts/custom?idea=${encodeURIComponent(gift.id)}`}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
                >
                  להתאים את המתנה
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>

      <Link
        href="/create-event/gifts/organize"
        className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground transition-colors hover:bg-brand-soft"
      >
        חזרה למתנות שלי
      </Link>
    </div>
  );
}
