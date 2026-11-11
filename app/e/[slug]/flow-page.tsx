"use client";

/* Host-uploaded image URLs are arbitrary, so next/image remote patterns cannot cover them. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { getEventBySlug, guestEventPath } from "@/lib/events";
import { formatGiftAmount, getContributionsTotal, loadContributions } from "@/lib/guest-draft";
import {
  DEMO_EVENT_SLUG,
  DEMO_IMAGE_CREDIT,
  DEMO_SAMPLE_BADGE,
  DEMO_SAMPLE_FUNDING,
} from "@/lib/events/demo";
import { fromRouteParam } from "@/lib/events/slug";
import {
  ILLUSTRATIVE_LABEL,
  giftPhotoFit,
  resolveEventCover,
  resolveGiftImage,
  type ResolvedImage,
} from "@/lib/image-library";
import {
  continuityFromEvent,
  readContinuity,
  subscribeContinuity,
  writeContinuity,
  type ContinuityFunding,
} from "./continuity";
import { displayTitle } from "./display-title";
import { GiftFallback, Wordmark } from "./flagship-ui";
import { JourneyFrame } from "./journey-photo";
import styles from "./flagship.module.css";
import "./journey.css";

const steps = [
  { id: "gift", label: "מתנה" },
  { id: "greeting", label: "ברכה" },
  { id: "details", label: "פרטים" },
  { id: "payment", label: "תשלום" },
] as const;

type StepId = (typeof steps)[number]["id"] | "thanks";
type StepState = "done" | "current" | "next";

type ChoiceItem = { name: string; amount: number };

function readChoice(slug: string) {
  const chosen = loadContributions(slug);
  return {
    items: chosen
      .filter((item) => item.amount > 0)
      .map((item) => ({ name: item.giftName, amount: item.amount })),
    total: getContributionsTotal(chosen),
  };
}

function MoneyLine({ text, className }: { text: string; className: string }) {
  const parts = text.split(/(\u2066[^\u2069]*\u2069)/g).filter(Boolean);
  return (
    <p className={className}>
      {parts.map((part, index) =>
        part.startsWith("\u2066") ? (
          <span key={index} className={styles.moneyKeep}>
            {part.replace(/ ₪/g, "\u00A0₪")}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}

function StepCheck({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path
        d="M3.2 8.2 6.4 11.2 12.8 4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type JourneyVisual = {
  cover: ResolvedImage;
  gift: ResolvedImage;
  hostName: string;
};

function journeyVisual(stored: NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>): JourneyVisual {
  const gifts = [...stored.gifts]
    .filter((item) => item.active !== false)
    .sort((a, b) => a.priority - b.priority);
  const chosen = loadContributions(stored.slug)[0];
  const gift = (chosen ? gifts.find((item) => item.id === chosen.giftId) : undefined) ?? gifts[0];
  const giftTitle = gift?.title || chosen?.giftName || "";
  return {
    hostName: stored.hostName,
    cover: resolveEventCover({
      hostImageUrl: stored.coverImage,
      eventType: stored.eventType,
      title: stored.title,
      alt: stored.title,
    }),
    gift: resolveGiftImage({
      hostImageUrl: gift?.imageUrl || "",
      title: giftTitle,
      description: gift?.description || "",
      alt: giftTitle,
    }),
  };
}

export function FlowPage({
  step,
  title,
  lede,
  notice,
  children,
}: {
  step: StepId;
  title: string;
  lede?: string;
  notice?: string;
  children: ReactNode;
}) {
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const mark = useSyncExternalStore(
    subscribeContinuity,
    () => (slug ? readContinuity(slug) : null),
    () => null,
  );
  const [visual, setVisual] = useState<{ slug: string; data: JourneyVisual } | null>(null);
  const scene = visual?.slug === slug ? visual.data : null;

  useEffect(() => {
    if (!slug) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const stored = await getEventBySlug(slug);
      if (cancelled || !stored) {
        return;
      }
      const cached = readContinuity(slug);
      const known = continuityFromEvent(
        stored,
        slug === DEMO_EVENT_SLUG ? [{ ...DEMO_SAMPLE_FUNDING }] : null,
      );
      const immediate = {
        ...known,
        progress: known.progress || cached?.progress || "",
        fundingLine: known.fundingLine || cached?.fundingLine || "",
      };
      if (!cancelled) {
        setVisual({ slug, data: journeyVisual(stored) });
        writeContinuity(slug, immediate);
        if (stored.slug && stored.slug !== slug) {
          writeContinuity(stored.slug, immediate);
        }
      }

      try {
        const fundingRows: ContinuityFunding[] =
          slug === DEMO_EVENT_SLUG
            ? [{ ...DEMO_SAMPLE_FUNDING }]
            : await (async () => {
                const response = await fetch(`/api/events/${encodeURIComponent(slug)}/funding`, {
                  cache: "no-store",
                });
                if (!response.ok) {
                  return [];
                }
                const body = (await response.json()) as { gifts?: ContinuityFunding[] };
                return body.gifts ?? [];
              })();
        if (cancelled || fundingRows.length === 0) {
          return;
        }
        const withFunding = continuityFromEvent(stored, fundingRows);
        writeContinuity(slug, withFunding);
        if (stored.slug && stored.slug !== slug) {
          writeContinuity(stored.slug, withFunding);
        }
      } catch {
        // The event name is already on screen. Funding can stay blank.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const current = step === "thanks" ? steps.length : steps.findIndex((item) => item.id === step);
  const choice = useSyncExternalStore(
    () => () => {},
    () => (slug && step !== "thanks" ? JSON.stringify(readChoice(slug)) : ""),
    () => "",
  );
  const parsed = choice ? (JSON.parse(choice) as { items: ChoiceItem[]; total: number }) : { items: [], total: 0 };

  const hero = scene?.cover.src ? scene.cover : scene?.gift.src ? scene.gift : null;
  const thumb = scene?.gift.src ? scene.gift : scene?.cover.src ? scene.cover : null;
  const showThumbLabel = Boolean(scene?.gift.illustrative && scene.gift.src);

  function renderThumb() {
    if (thumb && thumb.kind !== "illustration") {
      return (
        <span data-journey-thumb="" data-fit={giftPhotoFit(thumb.src)}>
          <img
            className={styles.choiceThumb}
            src={thumb.src}
            alt=""
            width={72}
            height={72}
            data-gift-photo={scene?.gift.src ? "" : undefined}
            data-image-source={thumb.kind}
          />
        </span>
      );
    }
    if (mark?.giftImage) {
      return (
        <img className={styles.choiceThumb} src={mark.giftImage} alt="" width={72} height={72} data-gift-photo="" />
      );
    }
    if (mark?.cover) {
      return <img className={styles.choiceThumb} src={mark.cover} alt="" width={72} height={72} />;
    }
    return <GiftFallback compact />;
  }
  function renderChoice(amounts: boolean, labelled: boolean) {
    const rows = parsed.items.length > 0 ? parsed.items : mark?.giftName ? [{ name: mark.giftName, amount: 0 }] : [];
    return (
      <div className={styles.choiceCard} data-journey-choice="">
        {mark ? (
          <p className={styles.choiceEvent} data-continuity-title={labelled ? "" : undefined}>
            {displayTitle(mark.title)}
          </p>
        ) : (
          <div className={styles.bones} aria-label="טוענים את פרטי האירוע">
            <span />
            <span />
          </div>
        )}
        {rows.map((item, index) => (
          <div key={`${item.name}-${item.amount}`} className={styles.choiceGift}>
            <div className={styles.choiceGiftMain}>
              {renderThumb()}
              <div className={styles.choiceGiftCopy}>
                <p className={styles.choiceName} data-reveal-card="">
                  {item.name}
                </p>
                {index === 0 && showThumbLabel ? (
                  <span data-illustrative-label="">{ILLUSTRATIVE_LABEL}</span>
                ) : null}
                {index === 0 && mark?.progress ? (
                  <MoneyLine text={mark.progress} className={styles.choiceProgress} />
                ) : null}
              </div>
            </div>
            {amounts && item.amount > 0 ? (
              <b className={styles.choiceAmount}>{formatGiftAmount(item.amount)}</b>
            ) : null}
          </div>
        ))}
        {amounts && parsed.total > 0 ? (
          <p className={styles.choiceTotal}>
            <span>סה״כ</span>
            <b>{formatGiftAmount(parsed.total)}</b>
          </p>
        ) : null}
      </div>
    );
  }

  function renderHero() {
    if (step !== "greeting" || !hero) {
      return null;
    }
    return (
      <figure data-journey-hero="">
        <JourneyFrame image={hero} />
      </figure>
    );
  }

  return (
    <div data-journey="" data-journey-step={step}>
      <header className={styles.header}>
        <Wordmark />
      </header>
      {slug === DEMO_EVENT_SLUG ? (
        <div className={styles.demoNote} data-journey-demo-note="">
          <p className={styles.demoBadge}>{DEMO_SAMPLE_BADGE}</p>
          <p className={styles.demoCredit}>{DEMO_IMAGE_CREDIT}</p>
        </div>
      ) : null}
      <div
        className={[
          styles.flow,
          step === "thanks" ? styles.flowThanks : "",
          step === "payment" ? styles.flowPay : "",
          step === "greeting" || step === "details" ? styles.flowForm : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-journey-flow=""
      >
        <div className={styles.flowMain} data-journey-main="">
        <div className={`${styles.flowHead} ${styles.flowIn}`} data-journey-head="">
          {step === "thanks" ? (
            <p className={styles.successMark} data-journey-success="" aria-hidden="true">
              <StepCheck size={22} />
            </p>
          ) : (
            <ol className={styles.stepNav} data-journey-steps="" aria-label="שלבי ההשתתפות">
              {steps.map((item, index) => {
                const state: StepState = item.id === step ? "current" : index < current ? "done" : "next";
                const href = slug
                  ? item.id === "gift"
                    ? guestEventPath(slug)
                    : guestEventPath(slug, item.id)
                  : "";
                const face = (
                  <>
                    <span className={styles.stepMark} data-journey-mark="" aria-hidden="true">
                      {state === "done" ? <StepCheck size={12} /> : index + 1}
                    </span>
                    <span className={styles.stepLabel} data-journey-label="">
                      {item.label}
                    </span>
                  </>
                );
                return (
                  <li
                    key={item.id}
                    className={styles.stepSlot}
                    data-step={state}
                    aria-current={state === "current" ? "step" : undefined}
                    aria-label={`שלב ${index + 1} מתוך 4`}
                  >
                    {index > 0 ? (
                      <span className={styles.stepLine} data-journey-line="" aria-hidden="true" />
                    ) : null}
                    {state === "done" && href ? (
                      <Link href={href} className={styles.stepLink}>
                        {face}
                      </Link>
                    ) : (
                      <span className={styles.stepFace}>{face}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <h1 className={styles.flowTitle} data-journey-title="">
            {title}
          </h1>
          {lede ? (
            <p className={styles.flowLede} data-journey-lede="">
              {lede}
            </p>
          ) : null}
          {step === "greeting" && scene?.hostName ? (
            <p data-journey-host="">{`מאת ${scene.hostName}`}</p>
          ) : null}
          {notice ? <p className={styles.pay}>{notice}</p> : null}
          {renderHero()}
        </div>
        {step !== "thanks" && step !== "payment" && mark ? (
          <div className={styles.compactRow}>{renderChoice(true, false)}</div>
        ) : null}
        <div className={styles.flowBody} data-journey-body="">
          {children}
        </div>
        </div>
        {step !== "thanks" ? (
          <aside
            className={styles.flowAside}
            data-journey-aside=""
            data-pay-hero={step === "payment" ? "" : undefined}
          >
            {renderHero()}
            <div aria-busy={mark ? undefined : true}>{renderChoice(step !== "payment", true)}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
