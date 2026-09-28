"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatEventDate, formatEventTime } from "@/lib/event-draft";
import { getEventBySlug, guestEventPath, type StoredEvent } from "@/lib/events";
import { fromRouteParam } from "@/lib/events/slug";
import {
  formatGiftAmount,
  loadContributions,
  saveContributions,
  type GuestContribution,
} from "@/lib/guest-draft";

const DEFAULT_AMOUNTS = [150, 250, 350, 500];

type DisplayGift = {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
};

function amountButtonClass(selected: boolean) {
  return `flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
    selected
      ? "border-brand bg-brand-soft text-brand-hover shadow-md"
      : "border-border bg-white text-foreground hover:bg-brand-soft/40"
  }`;
}

function parseAmount(value: string) {
  const amount = Number(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return amount;
}

export default function GuestEventView() {
  const router = useRouter();
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const [event, setEvent] = useState<StoredEvent | null>(null);
  const [missing, setMissing] = useState(false);
  const [hostGifts, setHostGifts] = useState<DisplayGift[]>([]);
  const [contributions, setContributions] = useState<GuestContribution[]>([]);
  const [customDrafts, setCustomDrafts] = useState<Record<string, string>>({});
  const [openCustom, setOpenCustom] = useState<Record<string, boolean>>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!slug) {
        if (!cancelled) {
          setMissing(true);
          setEvent(null);
        }
        return;
      }

      const stored = await getEventBySlug(slug);
      if (cancelled) {
        return;
      }

      if (!stored) {
        setMissing(true);
        setEvent(null);
        return;
      }

      const eventSlug = stored.slug;

      const available = [...stored.gifts]
        .filter((gift) => gift.active !== false)
        .sort((a, b) => a.priority - b.priority)
        .map((gift) => ({
          id: gift.id,
          name: gift.title,
          description: gift.description,
          price: gift.targetAmount,
          emoji: gift.icon,
        }));

      setMissing(false);
      setEvent(stored);
      setHostGifts(available);

      const knownIds = new Set(available.map((gift) => gift.id));
      const loaded = loadContributions(eventSlug).filter((item) =>
        knownIds.has(item.giftId),
      );
      setContributions(loaded);
      saveContributions(eventSlug, loaded);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const suggestedAmounts = useMemo(() => {
    if (!event) {
      return DEFAULT_AMOUNTS;
    }
    return event.moneyAmounts.length > 0 ? event.moneyAmounts : DEFAULT_AMOUNTS;
  }, [event]);

  const showSuggested = event?.moneyDisplay !== "hidden";
  const allowCustom = event?.allowCustomAmount !== false || !showSuggested;
  const total = contributions.reduce((sum, item) => sum + item.amount, 0);

  function contributionFor(giftId: string) {
    return contributions.find((item) => item.giftId === giftId);
  }

  function storageSlug() {
    return event?.slug || slug;
  }

  function upsertContribution(gift: DisplayGift, amount: number) {
    setContributions((current) => {
      const next = [
        ...current.filter((item) => item.giftId !== gift.id),
        { giftId: gift.id, giftName: gift.name, amount },
      ];
      saveContributions(storageSlug(), next);
      return next;
    });
  }

  function removeContribution(giftId: string) {
    setContributions((current) => {
      const next = current.filter((item) => item.giftId !== giftId);
      saveContributions(storageSlug(), next);
      return next;
    });
    setOpenCustom((current) => ({ ...current, [giftId]: false }));
    setCustomErrors((current) => ({ ...current, [giftId]: "" }));
  }

  function selectSuggested(gift: DisplayGift, amount: number) {
    upsertContribution(gift, amount);
    setOpenCustom((current) => ({ ...current, [gift.id]: false }));
    setCustomErrors((current) => ({ ...current, [gift.id]: "" }));
  }

  function applyCustom(gift: DisplayGift, raw: string) {
    const amount = parseAmount(raw);
    if (!amount) {
      setCustomErrors((current) => ({
        ...current,
        [gift.id]: "נא להזין סכום גדול מ־0",
      }));
      return;
    }

    setCustomErrors((current) => ({ ...current, [gift.id]: "" }));
    upsertContribution(gift, amount);
  }

  if (missing) {
    return (
      <p className="mt-10 text-center text-base text-muted">
        האירוע לא נמצא.
      </p>
    );
  }

  if (!event) {
    return null;
  }

  const location = [event.venueName, event.address].filter(Boolean).join(", ");

  return (
    <div className="mt-8 flex flex-col gap-6 pb-36">
      {event.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.coverImage}
          alt=""
          className="h-52 w-full rounded-3xl object-cover"
        />
      ) : (
        <div className="flex h-36 items-center justify-center rounded-3xl bg-brand-soft text-brand">
          LOLO
        </div>
      )}

      <div className="text-center">
        {event.hostName ? (
          <p className="text-sm font-medium text-muted">
            הזמנה מאת {event.hostName}
          </p>
        ) : null}
        <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground">
          {event.title || "האירוע"}
        </h1>
        {event.date || event.time ? (
          <p className="mt-3 text-base text-muted">
            {[formatEventDate(event.date), formatEventTime(event.time)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {location ? (
          <p className="mt-1 text-base text-muted">{location}</p>
        ) : null}
      </div>

      {event.message ? (
        <p className="rounded-3xl bg-white px-5 py-4 text-center text-base leading-relaxed text-foreground">
          {event.message}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-center text-lg font-bold text-foreground">
          מה תרצו להעניק?
        </h2>
        {hostGifts.map((gift) => {
          const contribution = contributionFor(gift.id);
          const selected = Boolean(contribution);
          const customOpen = Boolean(openCustom[gift.id]) || !showSuggested;
          const customIsSelected =
            Boolean(contribution) &&
            !suggestedAmounts.includes(contribution?.amount ?? -1);

          return (
            <article
              key={gift.id}
              className={`rounded-3xl border-2 p-5 ${
                selected
                  ? "border-brand bg-brand-soft/40"
                  : "border-border bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl">
                  {gift.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      {gift.name}
                    </h3>
                    {selected ? (
                      <span className="text-sm font-bold text-brand">
                        ✓ {formatGiftAmount(contribution?.amount ?? 0)}
                      </span>
                    ) : null}
                  </div>
                  {gift.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {gift.description}
                    </p>
                  ) : null}
                  {showSuggested && gift.price > 0 ? (
                    <p className="mt-2 text-sm font-medium text-brand">
                      יעד: {formatGiftAmount(gift.price)}
                    </p>
                  ) : null}
                </div>
              </div>

              {showSuggested ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {suggestedAmounts.map((amount) => {
                    const amountSelected = contribution?.amount === amount;

                    return (
                      <button
                        key={amount}
                        type="button"
                        aria-pressed={amountSelected}
                        onClick={() => selectSuggested(gift, amount)}
                        className={amountButtonClass(amountSelected)}
                      >
                        {amountSelected ? <span aria-hidden>✓</span> : null}
                        {formatGiftAmount(amount)}
                      </button>
                    );
                  })}
                  {allowCustom ? (
                    <button
                      type="button"
                      aria-pressed={customOpen && customIsSelected}
                      onClick={() =>
                        setOpenCustom((current) => ({
                          ...current,
                          [gift.id]: true,
                        }))
                      }
                      className={amountButtonClass(
                        customOpen && (customIsSelected || !contribution),
                      )}
                    >
                      {customIsSelected ? <span aria-hidden>✓</span> : null}
                      {customIsSelected
                        ? formatGiftAmount(contribution?.amount ?? 0)
                        : "סכום אחר"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {allowCustom && customOpen ? (
                <label className="mt-4 flex flex-col gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    הזינו סכום
                  </span>
                  <div className="flex h-12 items-center rounded-2xl border border-border bg-white px-4">
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={customDrafts[gift.id] ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCustomDrafts((current) => ({
                          ...current,
                          [gift.id]: value,
                        }));
                        const amount = parseAmount(value);
                        if (amount) {
                          applyCustom(gift, value);
                        } else if (value.trim() !== "") {
                          setCustomErrors((current) => ({
                            ...current,
                            [gift.id]: "נא להזין סכום גדול מ־0",
                          }));
                        }
                      }}
                      className="w-full bg-transparent text-base text-foreground outline-none"
                    />
                    <span className="mr-2 text-sm font-semibold text-muted">
                      ₪
                    </span>
                  </div>
                  {customErrors[gift.id] ? (
                    <span className="text-sm text-brand">
                      {customErrors[gift.id]}
                    </span>
                  ) : null}
                </label>
              ) : null}

              {selected ? (
                <button
                  type="button"
                  onClick={() => removeContribution(gift.id)}
                  className="mt-4 cursor-pointer text-sm font-semibold text-brand hover:text-brand-hover"
                >
                  הסרת מתנה
                </button>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="rounded-3xl border border-border bg-white p-5">
        <h2 className="text-base font-bold text-foreground">המתנה שלכם</h2>
        {contributions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">עדיין לא נבחרה מתנה.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {contributions.map((item) => (
              <li
                key={item.giftId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="font-medium text-foreground">{item.giftName}</span>
                <span className="font-semibold text-brand">
                  {formatGiftAmount(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-base font-bold text-brand">
          סה״כ: {formatGiftAmount(total)}
        </p>
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-white/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto w-full max-w-lg">
          <button
            type="button"
            disabled={total <= 0}
            onClick={() => {
              saveContributions(storageSlug(), contributions);
              router.push(guestEventPath(storageSlug(), "greeting"));
            }}
            className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand/40 disabled:hover:bg-brand/40"
          >
            ממשיכים לברכה • {formatGiftAmount(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
