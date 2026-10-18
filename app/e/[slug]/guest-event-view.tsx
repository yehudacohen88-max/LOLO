"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatEventTime } from "@/lib/event-draft";
import { getEventBySlug, guestEventPath, type StoredEvent } from "@/lib/events";
import { fromRouteParam } from "@/lib/events/slug";
import {
  formatGiftAmount,
  loadContributions,
  saveContributions,
  type GuestContribution,
} from "@/lib/guest-draft";
import {
  CountAmount,
  Frame,
  GiftIcon,
  GiftScene,
  LockIcon,
  Portrait,
  ProgressRibbon,
  WishThumb,
} from "./flagship-ui";
import styles from "./flagship.module.css";

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
  imageUrl: string;
  storeName: string;
};

function parseAmount(value: string) {
  const amount = Number(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return amount;
}

function occasionDate(date: string) {
  if (!date) {
    return "";
  }
  const parsed = new Date(`${date}T00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function monogramFor(title: string) {
  const letter = title.trim().charAt(0);
  return letter || "ל";
}

function focusAxis(value: number) {
  const percent = value >= 0 && value <= 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, percent));
}

function coverObjectPosition(event: StoredEvent) {
  const extra = event as StoredEvent & {
    coverFocalPoint?: { x?: number; y?: number } | null;
    coverFocus?: { x?: number; y?: number } | string | null;
  };
  const raw = extra.coverFocalPoint ?? extra.coverFocus ?? null;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  if (raw && typeof raw === "object") {
    const x = Number(raw.x);
    const y = Number(raw.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return `${focusAxis(x)}% ${focusAxis(y)}%`;
    }
  }
  return "center 28%";
}

function moneyLeft(target: number, raised: number) {
  if (!(target > 0)) {
    return null;
  }
  const left = Math.round((target - raised) * 100) / 100;
  return left > 0 ? left : 0;
}

function friendCount(count: number) {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (safe === 0) {
    return "";
  }
  if (safe === 1) {
    return "חבר אחד";
  }
  return `${safe.toLocaleString("he-IL")} חברים`;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M2.5 7.2 5.4 10 11.5 3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  const [amountHint, setAmountHint] = useState(false);

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
    setAmountHint(false);
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
    setAmountHint(false);
    upsertContribution(gift, amount);
  }

  function renderAmounts(gift: DisplayGift) {
    const contribution = contributionFor(gift.id);
    const customOpen = Boolean(openCustom[gift.id]) || !showSuggested;
    const customIsSelected =
      Boolean(contribution) && !suggestedAmounts.includes(contribution?.amount ?? -1);
    const errorId = `amount-error-${gift.id}`;

    return (
      <div>
        {showSuggested ? (
          <div className={styles.amounts}>
            {suggestedAmounts.map((amount) => {
              const amountSelected = contribution?.amount === amount;
              return (
                <button
                  key={amount}
                  type="button"
                  aria-pressed={amountSelected}
                  onClick={() => selectSuggested(gift, amount)}
                  className={`${styles.amount} ${amountSelected ? styles.amountOn : ""}`}
                >
                  {amountSelected ? <CheckIcon /> : null}
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
                className={`${styles.amount} ${
                  customOpen && (customIsSelected || !contribution) ? styles.amountOn : ""
                }`}
              >
                {customIsSelected ? <CheckIcon /> : null}
                {customIsSelected
                  ? formatGiftAmount(contribution?.amount ?? 0)
                  : "סכום אחר"}
              </button>
            ) : null}
          </div>
        ) : null}

        {allowCustom && customOpen ? (
          <label className={styles.custom}>
            <span>הזינו סכום</span>
            <span className={styles.field}>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                dir="ltr"
                aria-invalid={Boolean(customErrors[gift.id])}
                aria-describedby={customErrors[gift.id] ? errorId : undefined}
                value={customDrafts[gift.id] ?? ""}
                onChange={(input) => {
                  const value = input.target.value;
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
              />
              <span className={styles.shekel}>₪</span>
            </span>
            {customErrors[gift.id] ? (
              <span id={errorId} className={styles.error}>
                {customErrors[gift.id]}
              </span>
            ) : null}
          </label>
        ) : null}

        {contribution ? (
          <button
            type="button"
            onClick={() => removeContribution(gift.id)}
            className={styles.remove}
          >
            הסרת מתנה
          </button>
        ) : null}
      </div>
    );
  }

  function renderProgress(gift: DisplayGift, prominent: boolean) {
    if (fundingNote && prominent) {
      return (
        <p className={styles.quiet} role="status">
          {fundingNote}
        </p>
      );
    }
    if (!funding && !fundingNote && prominent) {
      return (
        <p className={styles.quiet} role="status">
          טוענים את ההתקדמות...
        </p>
      );
    }
    const progress = funding?.[gift.id];
    if (!progress) {
      return null;
    }

    const raised = progress.raisedAmount;
    const count = progress.contributorCount;
    const percent = progress.percentOfTarget;
    const target = gift.price > 0 ? gift.price : null;
    const left = target == null ? null : moneyLeft(target, raised);
    const friends = friendCount(count);
    const hasActivity = raised > 0 || count > 0;
    const showBar = percent != null && target != null;
    if (!hasActivity && !showBar && !target) {
      return null;
    }

    const summary = [
      raised > 0 ? `נאסף ${formatGiftAmount(raised)}` : "",
      target ? `יעד ${formatGiftAmount(target)}` : "",
      friends,
    ]
      .filter(Boolean)
      .join(", ");

    return (
      <div>
        {count > 1 ? (
          <h2 className={styles.joined}>
            כבר <b>{count.toLocaleString("he-IL")}</b> חברים הצטרפו
          </h2>
        ) : count === 1 ? (
          <h2 className={styles.joined}>
            <b>חבר אחד</b> כבר הצטרף
          </h2>
        ) : prominent ? (
          <p className={styles.quiet}>אין עדיין משתתפים</p>
        ) : null}

        {hasActivity ? (
          <div className={styles.nums}>
            <span className={styles.got}>
              <CountAmount value={raised} />
            </span>
            {target ? (
              <span className={styles.of}>מתוך {formatGiftAmount(target)}</span>
            ) : null}
          </div>
        ) : target ? (
          <p className={styles.nums}>
            <span className={styles.of}>יעד {formatGiftAmount(target)}</span>
          </p>
        ) : null}

        {showBar && percent != null ? (
          <ProgressRibbon percent={percent} label={summary || "התקדמות המתנה"} />
        ) : null}

        {percent != null && percent >= 100 ? (
          <p className={styles.reached}>
            {percent > 100 ? "היעד הושג ואף יותר" : "היעד הושג"}
          </p>
        ) : left != null && left > 0 && raised > 0 ? (
          <p className={styles.remain}>
            {percent != null && percent >= 80 ? (
              <>
                עוד <b>{formatGiftAmount(left)}</b> — והמתנה יוצאת לדרך
              </>
            ) : (
              <>
                נותרו <b>{formatGiftAmount(left)}</b>
              </>
            )}
          </p>
        ) : null}
      </div>
    );
  }

  if (missing) {
    return (
      <Frame>
        <div className={styles.status}>
          <h1>האירוע לא נמצא</h1>
          <p>הקישור לא מוביל לאירוע פעיל. בקשו מהמארח קישור חדש, או חזרו לדף הבית.</p>
          <Link href="/" className={styles.statusLink}>
            לדף הבית
          </Link>
        </div>
      </Frame>
    );
  }

  if (!event) {
    return (
      <Frame>
        <p className={styles.status} role="status">
          טוענים את האירוע...
        </p>
      </Frame>
    );
  }

  const primary = hostGifts[0];
  const others = hostGifts.slice(1);
  const place = [event.venueName, event.address].filter(Boolean).join(", ");
  const kicker = [
    event.eventType,
    occasionDate(event.date),
    formatEventTime(event.time),
    place,
  ].filter(Boolean);
  const message = event.message.trim();
  const quoted = /^[״"“«]/.test(message);
  const primaryFunding = primary ? funding?.[primary.id] : undefined;
  const primaryLeft =
    primary && primary.price > 0 && primaryFunding
      ? moneyLeft(primary.price, primaryFunding.raisedAmount)
      : null;
  const primaryFriends = friendCount(primaryFunding?.contributorCount ?? 0);
  const showMini =
    Boolean(primaryFunding) &&
    ((primaryFunding?.raisedAmount ?? 0) > 0 ||
      (primaryFunding?.contributorCount ?? 0) > 0);
  const miniRatio =
    primaryFunding?.percentOfTarget == null
      ? 0
      : Math.min(1, Math.max(0, primaryFunding.percentOfTarget / 100));

  return (
    <Frame>
      <div className={styles.spread}>
        <Portrait
          src={event.coverImage}
          alt={event.title ? `תמונה לאירוע ${event.title}` : "תמונת האירוע"}
          monogram={monogramFor(event.title)}
          hostName={event.hostName.trim()}
          objectPosition={coverObjectPosition(event)}
        />

        <div className={`${styles.copy} ${styles.rise}`}>
          {kicker.length > 0 ? (
            <p className={styles.kicker}>
              {kicker.map((part, index) => (
                <span key={`${part}-${index}`} style={{ display: "contents" }}>
                  {index > 0 ? <span className={styles.dot} aria-hidden="true" /> : null}
                  <span>{part}</span>
                </span>
              ))}
            </p>
          ) : null}
          <h1 className={styles.title}>
            {(event.title || "האירוע").split(/(\d+)/).map((part, index) =>
              /^\d+$/.test(part) ? (
                <span key={`${part}-${index}`} className={styles.accent}>
                  {part}
                </span>
              ) : (
                <span key={`${part}-${index}`}>{part}</span>
              ),
            )}
          </h1>
          <p className={styles.sub}>מתנה מכל החברים</p>
          {primary ? (
            <button
              type="button"
              className={styles.wish}
              onClick={() => {
                const reduce = window.matchMedia(
                  "(prefers-reduced-motion: reduce)",
                ).matches;
                document.getElementById(`gift-${primary.id}`)?.scrollIntoView({
                  behavior: reduce ? "auto" : "smooth",
                  block: "start",
                });
              }}
            >
              <WishThumb src={primary.imageUrl} />
              <span className={styles.wishCopy}>
                <span className={styles.wishLabel}>המשאלה</span>
                <span className={styles.wishName}>{primary.name}</span>
              </span>
            </button>
          ) : null}
        </div>

        {primary ? (
          <section className={`${styles.feature} ${styles.rise} ${styles.d2}`} id={`gift-${primary.id}`}>
            <GiftScene src={primary.imageUrl} alt={primary.name} primary />
            <div className={styles.gmeta}>
              <p className={styles.label}>המשאלה</p>
              <h2 className={styles.giftName}>{primary.name}</h2>
              {primary.description ? (
                <p className={styles.muted}>{primary.description}</p>
              ) : null}
              {primary.storeName ? (
                <p className={styles.muted}>חנות: {primary.storeName}</p>
              ) : null}
              {primary.price > 0 ? (
                <p className={styles.muted}>
                  יעד: {formatGiftAmount(primary.price)}
                  <span className={styles.muted}> אפשר להשתתף בכל סכום.</span>
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {message ? (
          <blockquote className={`${styles.note} ${styles.rise} ${styles.d1}`}>
            <p>{quoted ? message : `״${message}״`}</p>
            {event.hostName.trim() ? (
              <footer className={styles.sig}>
                <span className={styles.avatar} aria-hidden="true">
                  {event.hostName.trim().charAt(0)}
                </span>
                <span>{event.hostName.trim()}</span>
              </footer>
            ) : null}
          </blockquote>
        ) : null}

        <aside className={styles.panel}>
          {primary ? renderProgress(primary, true) : (
            <p className={styles.quiet}>עדיין אין מתנות באירוע.</p>
          )}
          {primary ? renderAmounts(primary) : null}

          <section className={styles.summary}>
            <h2>המתנה שלכם</h2>
            {contributions.length === 0 ? (
              <p className={styles.quiet}>עדיין לא נבחרה מתנה.</p>
            ) : (
              <ul>
                {contributions.map((item) => (
                  <li key={item.giftId} className={styles.summaryRow}>
                    <span>{item.giftName}</span>
                    <span>{formatGiftAmount(item.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.total}>סה״כ: {formatGiftAmount(total)}</p>
          </section>

          <p className={styles.ease}>בוחרים סכום, כותבים ברכה — וזהו.</p>

          <div className={styles.join} data-join="">
            {showMini && primaryFunding && primary ? (
              <>
                <div className={styles.mini}>
                  <span>
                    {others.length > 0 ? `${primary.name}: ` : null}
                    <b>
                      {formatGiftAmount(primaryFunding.raisedAmount)}
                    </b>
                    {primary.price > 0
                      ? ` מתוך ${formatGiftAmount(primary.price)}`
                      : null}
                    {primaryFriends ? ` · ${primaryFriends}` : null}
                  </span>
                  {primaryLeft != null && primaryLeft > 0 ? (
                    <span className={styles.miniAside}>
                      עוד {formatGiftAmount(primaryLeft)}
                    </span>
                  ) : null}
                </div>
                {primaryFunding.percentOfTarget != null ? (
                  <div className={styles.miniBar} aria-hidden="true">
                    <span
                      className={styles.miniFill}
                      style={{ ["--fs-p" as string]: String(miniRatio) }}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
            {amountHint ? (
              <p id="join-amount-hint" className={styles.hint} role="alert">
                בחרו סכום כדי להצטרף
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (total <= 0) {
                  setAmountHint(true);
                  return;
                }
                saveContributions(storageSlug(), contributions);
                router.push(guestEventPath(storageSlug(), "greeting"));
              }}
              className={styles.cta}
              aria-describedby={amountHint ? "join-amount-hint" : undefined}
            >
              מצטרפים למתנה
              <GiftIcon />
            </button>
            <p className={styles.pay}>
              <LockIcon />
              תשלום הדגמה — לא מתבצע חיוב אמיתי
            </p>
          </div>
        </aside>

        {others.length > 0 ? (
          <section className={styles.more} aria-labelledby="more-gifts">
            <h2 id="more-gifts" className={styles.moreTitle}>
              עוד מתנות
            </h2>
            <div className={styles.moreGrid}>
              {others.map((gift) => (
                <article key={gift.id} className={styles.extra} id={`gift-${gift.id}`}>
                  <GiftScene src={gift.imageUrl} alt={gift.name} />
                  <div className={styles.gmeta}>
                    <h3 className={styles.giftName}>{gift.name}</h3>
                    {gift.description ? (
                      <p className={styles.muted}>{gift.description}</p>
                    ) : null}
                    {gift.storeName ? (
                      <p className={styles.muted}>חנות: {gift.storeName}</p>
                    ) : null}
                    {gift.price > 0 ? (
                      <p className={styles.muted}>
                        יעד: {formatGiftAmount(gift.price)}
                        <span> אפשר להשתתף בכל סכום.</span>
                      </p>
                    ) : null}
                  </div>
                  {renderProgress(gift, false)}
                  {renderAmounts(gift)}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <footer className={styles.footer}>
          <span>ביחד, מגשימים למישהו משאלה</span>
          <span>lolo · מתנות משותפות</span>
        </footer>
      </div>
    </Frame>
  );
}
