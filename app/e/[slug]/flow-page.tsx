"use client";

/* Host-uploaded image URLs are arbitrary, so next/image remote patterns cannot cover them. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { getEventBySlug, guestEventPath } from "@/lib/events";
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
import { Wordmark } from "./flagship-ui";
import styles from "./flagship.module.css";

const steps = [
  { id: "gift", label: "מתנה" },
  { id: "greeting", label: "ברכה" },
  { id: "details", label: "פרטים" },
  { id: "payment", label: "תשלום" },
] as const;

type StepId = (typeof steps)[number]["id"] | "thanks";
type StepState = "done" | "current" | "next";

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
  const letter = mark?.title.trim().charAt(0) ?? "";

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
        <aside className={styles.flowAside}>
          <div className={styles.continuity} aria-busy={mark ? undefined : true}>
            {mark?.cover ? (
              <img
                className={styles.thumb}
                src={mark.cover}
                alt=""
                width={224}
                height={280}
              />
            ) : (
              <span
                className={styles.thumbFallback}
                data-continuity-letter={mark ? "" : undefined}
                aria-hidden="true"
              >
                {letter}
              </span>
            )}
            {mark?.giftImage ? (
              <img className={styles.thumbGift} src={mark.giftImage} alt="" width={128} height={128} />
            ) : (
              <span className={styles.thumbGift} aria-hidden="true" />
            )}
            <div className={styles.continuityCopy}>
              {mark ? (
                <p className={styles.continuityTitle} data-continuity-title="">
                  {mark.title}
                </p>
              ) : (
                <div className={styles.bones} aria-label="טוענים את פרטי האירוע">
                  <span />
                  <span />
                </div>
              )}
              {mark?.giftName ? <p className={styles.continuityMeta}>{mark.giftName}</p> : null}
              {mark?.progress ? <p className={styles.continuityMeta}>{mark.progress}</p> : null}
            </div>
          </div>
        </aside>
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
        <div className={styles.flowBody}>{children}</div>
      </div>
    </>
  );
}
