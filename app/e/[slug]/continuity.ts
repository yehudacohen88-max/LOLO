import type { StoredEvent } from "@/lib/events";
import { loadContributions } from "@/lib/guest-draft";
import { giftProgressCopy } from "./progress-copy";

export type ContinuityMark = {
  title: string;
  cover: string;
  giftName: string;
  giftImage: string;
  progress: string;
  fundingLine: string;
};

export type ContinuityFunding = {
  giftId: string;
  raisedAmount: number;
  contributorCount: number;
  percentOfTarget: number | null;
};

const marks = new Map<string, ContinuityMark>();
const listeners = new Set<() => void>();

export function readContinuity(slug: string) {
  return marks.get(slug) ?? null;
}

export function subscribeContinuity(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function writeContinuity(slug: string, mark: ContinuityMark) {
  if (!slug || !mark.title) {
    return;
  }
  const current = marks.get(slug);
  if (
    current &&
    current.title === mark.title &&
    current.cover === mark.cover &&
    current.giftName === mark.giftName &&
    current.giftImage === mark.giftImage &&
    current.progress === mark.progress &&
    current.fundingLine === mark.fundingLine
  ) {
    return;
  }
  marks.set(slug, mark);
  listeners.forEach((listener) => listener());
}

export function continuityFromEvent(
  stored: StoredEvent,
  funding?: ContinuityFunding[] | null,
): ContinuityMark {
  const gifts = [...stored.gifts]
    .filter((item) => item.active !== false)
    .sort((a, b) => a.priority - b.priority);
  const chosen = loadContributions(stored.slug)[0];
  const gift = (chosen ? gifts.find((item) => item.id === chosen.giftId) : undefined) ?? gifts[0];
  const row = gift && funding ? funding.find((item) => item.giftId === gift.id) : undefined;
  const copy = row
    ? giftProgressCopy({
        raisedAmount: Number(row.raisedAmount),
        contributorCount: Number(row.contributorCount),
        percentOfTarget: row.percentOfTarget == null ? null : Number(row.percentOfTarget),
        targetAmount: gift && gift.targetAmount > 0 ? gift.targetAmount : null,
      })
    : null;
  const short = copy
    ? [
        copy.raisedText && copy.targetText
          ? `${copy.raisedText} מתוך ${copy.targetText}`
          : copy.targetText
            ? `יעד ${copy.targetText}`
            : "",
        copy.countShort ?? "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return {
    title: stored.title,
    cover: stored.coverImage,
    giftName: chosen?.giftName || gift?.title || "",
    giftImage: gift?.imageUrl || "",
    progress: short,
    fundingLine: copy
      ? [
          copy.countText,
          copy.raisedText && copy.targetText
            ? `${copy.raisedText} מתוך ${copy.targetText}`
            : (copy.raisedText ?? ""),
        ]
          .filter(Boolean)
          .join(" · ")
      : "",
  };
}
