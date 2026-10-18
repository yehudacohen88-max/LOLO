"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import FundingProgress from "@/components/funding-progress";
import GiftMedia from "@/components/gift-media";
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

type GiftFundingView = {
  raisedAmount: number;
  contributorCount: number;
  percentOfTarget: number | null;
};

type DisplayGift = {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  imageUrl: string;
  storeName: string;
};

function amountButtonClass(selected: boolean) {
  return `flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
    selected
      ? "border-brand bg-brand text-white shadow-md"
      : "border-border bg-ivory text-foreground hover:bg-brand-soft/70"
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
  const [funding, setFunding] = useState<Record<string, GiftFundingView> | null>(null);
  const [fundingNote, setFundingNote] = useState("");

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
          imageUrl: gift.imageUrl,
          storeName: gift.storeName,
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

  useEffect(() => {
    if (!slug) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/events/${encodeURIComponent(slug)}/funding`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error("unavailable");
        }
        const body = (await response.json()) as {
          gifts?: Array<GiftFundingView & { giftId: string }>;
        };
        if (cancelled) {
          return;
        }
        const next: Record<string, GiftFundingView> = {};
        for (const gift of body.gifts ?? []) {
          next[gift.giftId] = {
            raisedAmount: Number(gift.raisedAmount) || 0,
            contributorCount: Number(gift.contributorCount) || 0,
            percentOfTarget:
              gift.percentOfTarget == null ? null : Number(gift.percentOfTarget),
          };
        }
        setFunding(next);
        setFundingNote("");
      } catch {
        if (!cancelled) {
          setFunding(null);
          setFundingNote("ההתקדמות אינה זמינה כרגע.");
        }
      }
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
      <div className="mt-10 flex flex-col items-center text-center">
        <h1 className="lolo-title">האירוע לא נמצא</h1>
        <p className="mt-3 max-w-sm text-base leading-relaxed text-muted">
          הקישור לא מוביל לאירוע פעיל. בקשו מהמארח קישור חדש, או חזרו לדף הבית.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover"
        >
          לדף הבית
        </Link>
      </div>
    );
  }

  if (!event) {
    return (
      <p className="mt-10 text-center text-base text-muted" role="status">
        טוענים את האירוע...
      </p>
    );
  }

  const location = [event.venueName, event.address].filter(Boolean).join(", ");

  return (
    <div className="mt-6 flex flex-col gap-6 pb-36 lg:mt-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-14 lg:gap-y-8 lg:pb-0">
      <div className="flex flex-col gap-5 lg:sticky lg:top-8">
      <section className="lolo-hero lg:min-h-[32rem]">
        {event.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="lolo-hero-fallback" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#241018]/90 via-[#241018]/30 to-[#241018]/10" />
        <div className="relative flex min-h-[18.5rem] flex-col items-center justify-end px-6 pb-7 pt-16 text-center text-white lg:min-h-[32rem] lg:px-10">
          {event.hostName ? (
            <p className="text-sm font-semibold text-[#f6e6de]">
              הזמנה מאת {event.hostName}
            </p>
          ) : null}
          <h1 className="mt-2 max-w-md text-4xl font-medium leading-tight text-white sm:text-5xl">
            {event.title || "האירוע"}
          </h1>
          {event.date || event.time ? (
            <p className="mt-3 text-sm text-white/85">
              {[formatEventDate(event.date), formatEventTime(event.time)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {location ? <p className="mt-1 text-sm text-white/85">{location}</p> : null}
        </div>
      </section>

      {event.message ? (
        <p className="lolo-card px-5 py-5 text-center text-base leading-relaxed text-foreground">
          {event.message}
        </p>
      ) : null}

      <p className="text-center text-sm leading-relaxed text-muted lg:text-start">
        ביחד, אנחנו מגשימים משאלה. כל השתתפות מקרבת את המתנה — בלי סכום נכון או לא נכון.
      </p>
      </div>

      <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-4">
        <h2 className="text-center text-2xl font-medium text-foreground lg:text-start">
          המתנה שכולם נותנים יחד
        </h2>
        {fundingNote ? (
          <p className="text-center text-sm text-muted">{fundingNote}</p>
        ) : null}
        {!funding && !fundingNote ? (
          <p className="text-center text-sm text-muted">טוענים את ההתקדמות...</p>
        ) : null}
        {hostGifts.map((gift, index) => {
          const contribution = contributionFor(gift.id);
          const selected = Boolean(contribution);
          const customOpen = Boolean(openCustom[gift.id]) || !showSuggested;
          const customIsSelected =
            Boolean(contribution) &&
            !suggestedAmounts.includes(contribution?.amount ?? -1);

          return (
            <article
              key={gift.id}
              className={`overflow-hidden rounded-[1.75rem] border bg-ivory ${
                selected ? "border-brand shadow-[var(--shadow-lift)]" : "border-border"
              }`}
            >
              <GiftMedia
                imageUrl={gift.imageUrl}
                icon={gift.emoji}
                alt=""
                flush
                className="aspect-[3/2] h-auto w-full text-5xl lg:aspect-[5/2] lg:max-h-40 lg:text-4xl"
              />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {index === 0 ? (
                      <p className="mb-1 text-xs font-bold text-gold">הבחירה הראשונה של המארחים</p>
                    ) : null}
                    <h3 className="font-sans text-lg font-bold text-foreground">
                      {gift.name}
                    </h3>
                    {gift.storeName ? (
                      <p className="mt-1 text-sm text-muted">חנות: {gift.storeName}</p>
                    ) : null}
                  </div>
                  {selected ? (
                    <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand">
                      ✓ {formatGiftAmount(contribution?.amount ?? 0)}
                    </span>
                  ) : null}
                </div>
                {gift.description ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {gift.description}
                  </p>
                ) : null}
                {gift.price > 0 ? (
                  <p className="mt-2 text-sm font-medium text-brand">
                    יעד: {formatGiftAmount(gift.price)}
                    <span className="mt-1 block font-normal text-muted">
                      אפשר להשתתף בכל סכום.
                    </span>
                  </p>
                ) : null}
                {funding?.[gift.id] ? (
                  <FundingProgress
                    raisedAmount={funding[gift.id].raisedAmount}
                    percentOfTarget={funding[gift.id].percentOfTarget}
                    contributorCount={funding[gift.id].contributorCount}
                  />
                ) : null}

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
                      dir="ltr"
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
                  className="mt-4 min-h-11 cursor-pointer text-sm font-semibold text-brand hover:text-brand-hover"
                >
                  הסרת מתנה
                </button>
              ) : null}
              </div>
            </article>
          );
        })}
      </section>

      <section className="lolo-card p-5">
        <h2 className="font-sans text-base font-bold text-foreground">החלק שלכם במתנה</h2>
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[#fbf7f2]/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:z-auto lg:mt-2 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
        <div className="mx-auto w-full max-w-lg lg:max-w-none">
          <p className="mb-2 text-center text-xs font-semibold text-muted">
            {total > 0 ? "ההשתתפות שלכם מצטרפת למתנה" : "בחרו סכום כדי להצטרף למתנה"}
          </p>
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
    </div>
  );
}
