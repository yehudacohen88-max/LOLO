"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  formatEventDate,
  formatEventTime,
  loadEventDraft,
  resetEventCreationDraft,
  type EventDraft,
} from "@/lib/event-draft";
import { publishHostEvent } from "@/lib/events";
import { saveCreatedHostAccessCode } from "@/lib/host/created-code";
import { loadDraftGifts, type DraftGift } from "@/lib/draft-gifts";
import { formatPrice } from "@/lib/gifts";
import GiftMedia from "@/components/gift-media";
import { fetchActiveStoreOptions } from "@/lib/stores/active-stores-client";

type PreviewGift = DraftGift & {
  storeName: string;
};

export default function EventPreview() {
  const router = useRouter();
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [gifts, setGifts] = useState<PreviewGift[]>([]);
  const [selectedAmount, setSelectedAmount] = useState<number | "custom" | null>(
    null,
  );
  const [customAmount, setCustomAmount] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const eventDraft = loadEventDraft();
      if (cancelled) {
        return;
      }
      setDraft(eventDraft);
      if (eventDraft.giftMode === "money") {
        setGifts([]);
        return;
      }

      const selected = loadDraftGifts();
      let storeNames = new Map<string, string>();
      try {
        const stores = await fetchActiveStoreOptions();
        storeNames = new Map(stores.map((store) => [store.id, store.name.trim()]));
      } catch {
        storeNames = new Map();
      }

      if (cancelled) {
        return;
      }

      setGifts(
        selected.map((gift) => ({
          ...gift,
          storeName: storeNames.get(gift.storeId ?? "") ?? "",
        })),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!draft) {
    return <p className="mt-10 text-center text-sm text-muted">טוענים את התצוגה...</p>;
  }

  const location = [draft.venueName, draft.address].filter(Boolean).join(", ");
  const customSelectedValue = Number(customAmount);
  const selectedDisplayValue =
    selectedAmount === "custom"
      ? customSelectedValue >= 1
        ? customSelectedValue
        : null
      : selectedAmount;

  function amountButtonClass(selected: boolean) {
    return `flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-4 py-4 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
      selected
        ? "border-brand bg-brand-soft text-brand-hover shadow-md"
        : "border-border bg-white text-foreground hover:bg-brand-soft/40"
    }`;
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      {draft.imageDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={draft.imageDataUrl}
          alt=""
          className="h-52 w-full rounded-3xl object-cover"
        />
      ) : (
        <div className="flex h-36 items-center justify-center rounded-3xl bg-brand-soft text-sm text-brand">
          LOLO
        </div>
      )}

      <div className="text-center">
        {draft.hostName ? (
          <p className="text-sm font-medium text-muted">
            הזמנה מאת {draft.hostName}
          </p>
        ) : null}
        <h2 className="mt-2 text-3xl font-bold leading-tight text-foreground">
          {draft.eventName || "האירוע שלכם"}
        </h2>
        {draft.eventDate || draft.eventTime ? (
          <p className="mt-3 text-base text-muted">
            {[formatEventDate(draft.eventDate), formatEventTime(draft.eventTime)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {location ? (
          <p className="mt-1 text-base text-muted">{location}</p>
        ) : null}
      </div>

      {draft.message ? (
        <p className="rounded-3xl bg-white px-5 py-4 text-center text-base leading-relaxed text-foreground">
          {draft.message}
        </p>
      ) : null}

      {draft.giftMode === "money" ? (
        draft.moneyDisplay === "hidden" ? (
          <section className="rounded-3xl border border-border bg-white px-5 py-6 text-center">
            <h3 className="text-lg font-bold text-foreground">להשתתף במתנה</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              הנוכחות שלכם היא המתנה הכי גדולה. אם תרצו, תוכלו גם להשתתף במתנה
              לאירוע.
            </p>
          </section>
        ) : (
          <section>
            <h3 className="text-center text-lg font-bold text-foreground">
              מתנה לאירוע
            </h3>
            <p className="mt-1 text-center text-sm text-muted">
              בחרו את הסכום שתרצו להעניק
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {draft.moneyAmounts.map((amount) => {
                const selected = selectedAmount === amount;

                return (
                  <button
                    key={amount}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedAmount(amount)}
                    className={amountButtonClass(selected)}
                  >
                    {selected ? <span aria-hidden>✓</span> : null}
                    ₪{amount.toLocaleString("he-IL")}
                  </button>
                );
              })}
              {draft.allowCustomAmount ? (
                <button
                  type="button"
                  aria-pressed={selectedAmount === "custom"}
                  onClick={() => setSelectedAmount("custom")}
                  className={amountButtonClass(selectedAmount === "custom")}
                >
                  {selectedAmount === "custom" ? (
                    <span aria-hidden>✓</span>
                  ) : null}
                  {selectedAmount === "custom" && customSelectedValue >= 1
                    ? `₪${customSelectedValue.toLocaleString("he-IL")}`
                    : "סכום אחר"}
                </button>
              ) : null}
            </div>
            {selectedAmount === "custom" ? (
              <label className="mt-4 flex flex-col gap-2">
                <span className="text-sm font-semibold text-foreground">
                  הזינו סכום
                </span>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  className="h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none focus:border-brand"
                />
              </label>
            ) : null}
            {selectedDisplayValue ? (
              <p className="mt-4 text-center text-sm font-semibold text-brand">
                נבחר: ₪{selectedDisplayValue.toLocaleString("he-IL")}
              </p>
            ) : null}
          </section>
        )
      ) : gifts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-center text-lg font-bold text-foreground">
            המתנות לאירוע
          </h3>
          <ol className="flex flex-col gap-3">
            {gifts.map((gift) => (
              <li
                key={gift.id}
                className="rounded-3xl border border-border bg-white p-4"
              >
                <GiftMedia
                  imageUrl={gift.imageUrl}
                  icon={gift.icon}
                  alt=""
                  className="h-44 w-full text-5xl"
                />
                <div className="mt-4">
                  <h4 className="text-base font-bold text-foreground">{gift.title}</h4>
                  {gift.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {gift.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm font-semibold text-brand">
                    יעד: {formatPrice(gift.targetAmount)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    האורחים יכולים להשתתף בכל סכום.
                  </p>
                  {gift.storeName ? (
                    <p className="mt-2 text-sm text-muted">חנות: {gift.storeName}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="rounded-3xl border border-dashed border-border bg-white px-5 py-6 text-center text-sm text-muted">
          עדיין אין מתנות. חזרו והוסיפו לפחות מתנה אחת.
        </p>
      )}

      <div className="mt-2 flex flex-col gap-3">
        <Link
          href="/create-event/details"
          className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground transition-colors hover:bg-brand-soft"
        >
          חזרה לעריכה
        </Link>
        {publishError ? (
          <p className="text-center text-sm text-brand">{publishError}</p>
        ) : null}
        <button
          type="button"
          disabled={publishing || (draft.giftMode !== "money" && gifts.length === 0)}
          onClick={async () => {
            if (publishing) {
              return;
            }
            setPublishing(true);
            setPublishError("");
            try {
              const created = await publishHostEvent();
              resetEventCreationDraft();
              if (created.accessCode) {
                saveCreatedHostAccessCode(created.slug, created.accessCode);
              }
              router.push(
                `/create-event/success?slug=${encodeURIComponent(created.slug)}`,
              );
            } catch (error) {
              setPublishing(false);
              setPublishError(
                error instanceof Error ? error.message : "שמירת האירוע נכשלה.",
              );
            }
          }}
          className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand/40"
        >
          {publishing ? "יוצרים את האירוע..." : "יצירת האירוע"}
        </button>
      </div>
    </div>
  );
}
