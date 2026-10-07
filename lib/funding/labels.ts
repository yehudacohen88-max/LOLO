import { roundMoney } from "@/lib/money";

export function formatFundingPercent(percent: number) {
  const rounded = Math.round(roundMoney(percent) * 10) / 10;
  const hasFraction = Math.abs(rounded - Math.trunc(rounded)) > 0;
  const text = rounded.toLocaleString("he-IL", {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: hasFraction ? 1 : 0,
  });
  return `${text}%`;
}

export function contributorLabel(count: number) {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (safe === 0) {
    return "אין עדיין משתתפים";
  }
  if (safe === 1) {
    return "משתתף אחד";
  }
  return `${safe.toLocaleString("he-IL")} משתתפים`;
}
