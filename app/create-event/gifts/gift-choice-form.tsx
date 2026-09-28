"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loadEventDraft, saveEventDraft } from "@/lib/event-draft";
import { clearSelectedGifts } from "@/lib/gifts";
import { useIsClient } from "@/lib/use-is-client";

const options = [
  {
    id: "catalog",
    href: "/create-event/gifts/catalog",
    emoji: "🎁",
    title: "מתנות שבחרתי",
    description:
      "בוחרים מתנות מראש, והאורחים משתתפים במה שבאמת רוצים לקבל.",
    recommended: true,
  },
  {
    id: "money",
    href: "/create-event/gifts/money",
    emoji: "💝",
    title: "מתנה כספית",
    description: "האורחים בוחרים סכום ומעניקים מתנה כספית לאירוע.",
    recommended: false,
  },
] as const;

export default function GiftChoiceForm() {
  const router = useRouter();
  const isClient = useIsClient();
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<(typeof options)[number]["id"] | "">(
    "",
  );

  if (isClient && !ready) {
    const draft = loadEventDraft();
    if (draft.giftMode === "catalog" || draft.giftMode === "money") {
      setSelected(draft.giftMode);
    }
    setReady(true);
  }

  const selectedOption = options.find((option) => option.id === selected);

  return (
    <div className="mt-10 flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {options.map((option) => {
          const isSelected = selected === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelected(option.id)}
              aria-pressed={isSelected}
              className={`rounded-3xl border p-5 text-right transition-colors sm:p-6 ${
                isSelected
                  ? "border-brand bg-brand-soft"
                  : "border-border bg-white hover:bg-brand-soft/50"
              }`}
            >
              <div className="flex items-start gap-4">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl"
                  aria-hidden
                >
                  {option.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">
                      {option.title}
                    </h2>
                    {option.recommended ? (
                      <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">
                        מומלץ
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!selectedOption}
        onClick={() => {
          if (!selectedOption) {
            return;
          }

          if (selectedOption.id === "catalog") {
            saveEventDraft({
              giftMode: "catalog",
              moneyAmounts: [],
              allowCustomAmount: true,
              moneyDisplay: "amounts",
            });
          } else {
            clearSelectedGifts();
            saveEventDraft({ giftMode: "money" });
          }

          router.push(selectedOption.href);
        }}
        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand/40 disabled:hover:bg-brand/40"
      >
        ממשיכים
      </button>
    </div>
  );
}
