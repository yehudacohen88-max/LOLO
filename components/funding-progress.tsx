import { formatGiftAmount } from "@/lib/guest-draft";
import { contributorLabel, formatFundingPercent } from "@/lib/funding/labels";

type FundingProgressProps = {
  raisedAmount: number;
  pendingAmount?: number;
  percentOfTarget: number | null;
  contributorCount: number;
  showPending?: boolean;
  prominent?: boolean;
};

export default function FundingProgress({
  raisedAmount,
  pendingAmount = 0,
  percentOfTarget,
  contributorCount,
  showPending = false,
  prominent = false,
}: FundingProgressProps) {
  const overTarget = percentOfTarget != null && percentOfTarget > 100;
  const reachedTarget = percentOfTarget != null && percentOfTarget >= 100;
  const barWidth =
    percentOfTarget == null ? null : Math.min(100, Math.max(0, percentOfTarget));
  const summary = [
    `נאסף ${formatGiftAmount(raisedAmount)}`,
    percentOfTarget != null ? `${formatFundingPercent(percentOfTarget)} מהיעד` : "",
    contributorLabel(contributorCount),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mt-3" aria-label={summary}>
      <p className={prominent ? "text-2xl font-bold text-foreground" : "text-base font-semibold text-foreground"}>
        נאסף {formatGiftAmount(raisedAmount)}
      </p>
      {percentOfTarget != null ? (
        <p
          className={`mt-1 font-bold ${
            reachedTarget ? "text-lg text-brand" : "text-base text-foreground"
          }`}
        >
          {formatFundingPercent(percentOfTarget)} מהיעד
        </p>
      ) : null}
      {barWidth != null ? (
        <div className={`mt-2 overflow-hidden rounded-full bg-border ${prominent ? "h-3" : "h-2"}`} aria-hidden>
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      ) : null}
      <p className="mt-2 text-base text-muted">{contributorLabel(contributorCount)}</p>
      {overTarget ? (
        <p className="mt-2 text-base font-semibold text-brand">היעד הושג ואף יותר</p>
      ) : null}
      {showPending ? (
        <p className="mt-2 text-base text-muted">
          ממתין לתשלום: {formatGiftAmount(pendingAmount)}
        </p>
      ) : null}
    </div>
  );
}
