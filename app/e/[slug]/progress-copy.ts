import { formatGiftAmount } from "@/lib/guest-draft";
import { roundMoney } from "@/lib/money";

export type GiftProgressInput = {
  raisedAmount: number;
  contributorCount: number;
  percentOfTarget: number | null;
  targetAmount: number | null;
  prominent?: boolean;
};

export type GiftProgressCopy = {
  countText: string | null;
  countNumber: string | null;
  countShort: string | null;
  singleGuest: boolean;
  showEmptyGuests: boolean;
  raisedText: string | null;
  targetText: string | null;
  remainingText: string | null;
  closeToGoal: boolean;
  reached: "met" | "over" | null;
  percentText: string | null;
  percentValue: number | null;
  bar: number | null;
  summary: string;
};

function finiteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatPercent(value: number) {
  const cents = roundMoney(value);
  const text = Number.isInteger(cents)
    ? String(cents)
    : cents.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `\u2066${text}%\u2069`;
}

export function giftProgressCopy(input: GiftProgressInput): GiftProgressCopy {
  const raisedRaw = finiteNumber(input.raisedAmount);
  const raised = raisedRaw != null && raisedRaw >= 0 ? roundMoney(raisedRaw) : null;
  const countRaw = finiteNumber(input.contributorCount);
  const count = countRaw != null && countRaw >= 0 ? Math.floor(countRaw) : null;
  const targetRaw = finiteNumber(input.targetAmount);
  const target = targetRaw != null && targetRaw > 0 ? roundMoney(targetRaw) : null;
  const percentRaw = finiteNumber(input.percentOfTarget);
  const percent = percentRaw != null && percentRaw >= 0 ? roundMoney(percentRaw) : null;
  const remaining = raised != null && target != null ? roundMoney(target - raised) : null;

  let countText: string | null = null;
  let countNumber: string | null = null;
  let countShort: string | null = null;
  let singleGuest = false;
  if (count === 1) {
    singleGuest = true;
    countText = "חבר אחד כבר הצטרף";
    countShort = "חבר אחד";
  } else if (count != null && count > 1) {
    countNumber = count.toLocaleString("he-IL");
    countText = `כבר ${countNumber} חברים הצטרפו`;
    countShort = `${countNumber} חברים`;
  }

  const raisedText = raised != null && raised > 0 ? formatGiftAmount(raised) : null;
  const targetText = target != null ? formatGiftAmount(target) : null;
  const remainingText =
    remaining != null && remaining > 0 && raised != null && raised > 0
      ? formatGiftAmount(remaining)
      : null;
  const overByAmount = raised != null && target != null && raised > target;
  const metByAmount = raised != null && target != null && raised === target;
  let reached: GiftProgressCopy["reached"] = null;
  if (remaining != null && remaining > 0) {
    reached = null;
  } else if ((percent != null && percent > 100) || overByAmount) {
    reached = "over";
  } else if ((percent != null && percent >= 100) || metByAmount) {
    reached = "met";
  }

  const closeToGoal =
    reached == null &&
    percent != null &&
    percent >= 80 &&
    percent < 100 &&
    remainingText != null;
  const percentText = percent != null ? formatPercent(percent) : null;
  const bar =
    percent != null && target != null ? Math.min(1, Math.max(0, percent / 100)) : null;
  const summary = [
    reached === "over" ? "המטרה הושגה!" : "",
    raisedText ? `נאסף ${raisedText}` : "",
    targetText ? `יעד ${targetText}` : "",
    reached === "over" ? "" : (percentText ?? ""),
    countText ?? "",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    countText,
    countNumber,
    countShort,
    singleGuest,
    showEmptyGuests: Boolean(input.prominent) && count === 0,
    raisedText,
    targetText,
    remainingText,
    closeToGoal,
    reached,
    percentText,
    percentValue: percent,
    bar,
    summary: summary || "התקדמות המתנה",
  };
}

export function participationLine(copy: GiftProgressCopy) {
  const amount =
    copy.raisedText && copy.targetText
      ? `${copy.raisedText} מתוך ${copy.targetText}`
      : copy.raisedText;
  if (copy.reached === "over") {
    return ["המטרה הושגה!", amount, copy.countText].filter(Boolean).join(" · ");
  }
  return [
    copy.countText,
    amount,
    copy.reached === "met" ? "היעד הושג" : copy.percentText,
  ]
    .filter(Boolean)
    .join(" · ");
}
