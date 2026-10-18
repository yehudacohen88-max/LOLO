"use client";

/* Host-uploaded image URLs are arbitrary, so next/image remote patterns cannot cover them. */
/* eslint-disable @next/next/no-img-element */

import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getEventBySlug } from "@/lib/events";
import { fromRouteParam } from "@/lib/events/slug";
import { formatGiftAmount } from "@/lib/guest-draft";
import { Wordmark } from "./flagship-ui";
import { giftProgressCopy } from "./progress-copy";
import styles from "./flagship.module.css";

const steps = [
  { id: "gift", label: "מתנה" },
  { id: "greeting", label: "ברכה" },
  { id: "details", label: "פרטים" },
  { id: "payment", label: "תשלום" },
] as const;

type StepId = (typeof steps)[number]["id"] | "thanks";

type Mark = {
  title: string;
  cover: string;
  giftName: string;
  giftImage: string;
  progress: string;
};

export function FlowPage({
  step,
  title,
  lede,
  children,
}: {
  step: StepId;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const [mark, setMark] = useState<Mark | null>(null);

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
      const gift = [...stored.gifts]
        .filter((item) => item.active !== false)
        .sort((a, b) => a.priority - b.priority)[0];
      let progress = "";
      try {
        const response = await fetch(`/api/events/${encodeURIComponent(slug)}/funding`, {
          cache: "no-store",
        });
        if (response.ok && gift) {
          const body = (await response.json()) as {
            gifts?: Array<{
              giftId: string;
              raisedAmount: number;
              contributorCount: number;
              percentOfTarget: number | null;
            }>;
          };
          const row = body.gifts?.find((item) => item.giftId === gift.id);
          if (row) {
            const copy = giftProgressCopy({
              raisedAmount: Number(row.raisedAmount),
              contributorCount: Number(row.contributorCount),
              percentOfTarget:
                row.percentOfTarget == null ? null : Number(row.percentOfTarget),
              targetAmount: gift.targetAmount > 0 ? gift.targetAmount : null,
            });
            progress = [
              copy.raisedText && copy.targetText
                ? `${copy.raisedText} מתוך ${copy.targetText}`
                : copy.targetText
                  ? `יעד ${copy.targetText}`
                  : "",
              copy.countShort ?? "",
            ]
              .filter(Boolean)
              .join(" · ");
          }
        }
      } catch {
        progress = gift && gift.targetAmount > 0 ? `יעד ${formatGiftAmount(gift.targetAmount)}` : "";
      }
      if (!cancelled) {
        setMark({
          title: stored.title,
          cover: stored.coverImage,
          giftName: gift?.title ?? "",
          giftImage: gift?.imageUrl ?? "",
          progress,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const current = step === "thanks" ? steps.length : steps.findIndex((item) => item.id === step);
  const fill = step === "thanks" ? 1 : (current + 1) / steps.length;
  const letter = (mark?.title || "ל").trim().charAt(0) || "ל";

  return (
    <>
      <header className={styles.header}>
        <Wordmark />
      </header>
      <div className={`${styles.flow} ${step === "thanks" ? styles.flowThanks : ""}`}>
        <aside className={styles.flowAside}>
          <div className={styles.continuity}>
            {mark?.cover ? (
              <img
                className={styles.thumb}
                src={mark.cover}
                alt=""
                width={224}
                height={280}
              />
            ) : (
              <span className={styles.thumbFallback} aria-hidden="true">
                {letter}
              </span>
            )}
            {mark?.giftImage ? (
              <img className={styles.thumbGift} src={mark.giftImage} alt="" width={128} height={128} />
            ) : (
              <span className={styles.thumbGift} aria-hidden="true" />
            )}
            <div className={styles.continuityCopy}>
              <p className={styles.continuityTitle}>{mark?.title || "האירוע"}</p>
              {mark?.giftName ? <p className={styles.continuityMeta}>{mark.giftName}</p> : null}
              {mark?.progress ? <p className={styles.continuityMeta}>{mark.progress}</p> : null}
            </div>
          </div>
          <ol className={styles.steps} aria-label="שלבי ההשתתפות">
            {steps.map((item) => (
              <li key={item.id} aria-current={item.id === step ? "step" : undefined}>
                {item.label}
              </li>
            ))}
          </ol>
          <div className={styles.stepTrack} aria-hidden="true">
            <span className={styles.stepFill} style={{ ["--fs-step" as string]: String(fill) }} />
          </div>
        </aside>
        <div className={`${styles.flowHead} ${styles.flowIn}`}>
          <h1 className={styles.flowTitle}>{title}</h1>
          {lede ? <p className={styles.flowLede}>{lede}</p> : null}
        </div>
        <div className={styles.flowBody}>{children}</div>
      </div>
    </>
  );
}
