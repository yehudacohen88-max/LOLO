"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ResolvedPhoto from "@/app/design/resolved-photo";
import { formatPrice, giftCategories, gifts, type GiftCategory } from "@/lib/gifts";
import { resolveGiftImage } from "@/lib/image-library";

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
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-2">
        {giftCategories.map((item) => {
          const isActive = category === item;

          return (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              aria-pressed={isActive}
              className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold ${
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

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {visibleGifts.map((gift) => (
          <li key={gift.id}>
            <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-white">
              <ResolvedPhoto
                visual={resolveGiftImage({
                  title: gift.name,
                  description: gift.description,
                  alt: gift.name,
                })}
                ratio="card"
                fallback={
                  <div className="flex h-28 items-center justify-center bg-brand-soft text-3xl" aria-hidden>
                    {gift.emoji}
                  </div>
                }
              />
              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-base font-bold text-foreground">{gift.name}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{gift.description}</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  סכום מוצע {formatPrice(gift.price)}
                </p>
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
