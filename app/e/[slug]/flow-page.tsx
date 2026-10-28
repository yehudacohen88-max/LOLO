"use client";

/* Host-uploaded image URLs are arbitrary, so next/image remote patterns cannot cover them. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
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
  continuityFromEvent,
  readContinuity,
  subscribeContinuity,
  writeContinuity,
  type ContinuityFunding,
} from "./continuity";
import { displayTitle } from "./display-title";
import { GiftFallback, Wordmark } from "./flagship-ui";
import styles from "./flagship.module.css";

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

function StepCheck({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path
        d="M3.2 8.2 6.4 11.2 12.8 4.6"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

  const compactSrc = mark?.giftImage || mark?.cover || "";
  function renderThumb() {
    if (mark?.giftImage) {
      return (
        <img className={styles.choiceThumb} src={mark.giftImage} alt="" width={72} height={72} data-gift-photo="" />
      );
    }
    if (compactSrc) {
      return <img className={styles.choiceThumb} src={compactSrc} alt="" width={72} height={72} />;
    }
    return <GiftFallback compact />;
  }
  function renderLines() {
    return (
      <>
        {parsed.items.map((item) => (
          <p key={`${item.name}-${item.amount}`} className={styles.choiceLine}>
            <span data-reveal-card="">{item.name}</span>
            <b>{formatGiftAmount(item.amount)}</b>
          </p>
        ))}
        {parsed.total > 0 ? (
          <p className={styles.choiceTotal}>
            <span>סה״כ</span>
            <b>{formatGiftAmount(parsed.total)}</b>
          </p>
        ) : null}
        {mark?.progress ? <p className={styles.choiceProgress}>{mark.progress}</p> : null}
      </>
    );
  }

  return (
    <>
      <header className={styles.header}>
        <Wordmark />
      </header>
      {slug === DEMO_EVENT_SLUG ? (
        <div className={styles.demoNote}>
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
      >
        <div className={styles.flowMain}>
        <div className={`${styles.flowHead} ${styles.flowIn}`}>
          {step === "thanks" ? (
            <p className={styles.successMark} aria-hidden="true">
              <StepCheck size={22} />
            </p>
          ) : (
            <ol className={styles.stepNav} aria-label="שלבי ההשתתפות">
              {steps.map((item, index) => {
                const state: StepState = item.id === step ? "current" : index < current ? "done" : "next";
                const href = slug
                  ? item.id === "gift"
                    ? guestEventPath(slug)
                    : guestEventPath(slug, item.id)
                  : "";
                const face = (
                  <>
                    <span className={styles.stepMark} aria-hidden="true">
                      {state === "done" ? <StepCheck size={12} /> : index + 1}
                    </span>
                    <span className={styles.stepLabel}>{item.label}</span>
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
                    {index > 0 ? <span className={styles.stepLine} aria-hidden="true" /> : null}
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
          <h1 className={styles.flowTitle}>{title}</h1>
          {lede ? <p className={styles.flowLede}>{lede}</p> : null}
          {notice ? <p className={styles.pay}>{notice}</p> : null}
        </div>
        {step !== "thanks" && mark ? (
          <div className={styles.compactRow}>
            {renderThumb()}
            <div className={styles.compactCopy}>
              {renderLines()}
              <p className={styles.compactTitle}>{displayTitle(mark.title)}</p>
            </div>
          </div>
        ) : null}
        <div className={styles.flowBody}>{children}</div>
        </div>
        {step !== "thanks" ? (
          <aside
            className={styles.flowAside}
            data-pay-hero={step === "payment" ? "" : undefined}
          >
            <div className={styles.choiceCard} aria-busy={mark ? undefined : true}>
              {renderThumb()}
              <div className={styles.continuityCopy}>
                {mark ? (
                  <p className={styles.continuityTitle} data-continuity-title="">
                    {displayTitle(mark.title)}
                  </p>
                ) : (
                  <div className={styles.bones} aria-label="טוענים את פרטי האירוע">
                    <span />
                    <span />
                  </div>
                )}
                {renderLines()}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}
