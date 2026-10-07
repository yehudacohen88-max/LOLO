import { formatGiftAmount } from "@/lib/guest-draft";
import { contributorLabel, formatFundingPercent } from "@/lib/funding/labels";

type FundingProgressProps = {
  raisedAmount: number;
  pendingAmount?: number;
  percentOfTarget: number | null;
  contributorCount: number;
  showPending?: boolean;
};

export default function FundingProgress({
  raisedAmount,
  pendingAmount = 0,
  percentOfTarget,
  contributorCount,
  showPending = false,
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
      <p className="text-sm font-semibold text-foreground">
        נאסף {formatGiftAmount(raisedAmount)}
      </p>
      {percentOfTarget != null ? (
        <p
          className={`mt-1 font-bold ${
            reachedTarget ? "text-lg text-brand" : "text-sm text-foreground"
          }`}
        >
          {formatFundingPercent(percentOfTarget)} מהיעד
        </p>
      ) : null}
      <p className="mt-1 text-sm text-muted">{contributorLabel(contributorCount)}</p>
      {barWidth != null ? (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border" aria-hidden>
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      ) : null}
      {overTarget ? (
        <p className="mt-2 text-sm font-semibold text-brand">היעד הושג ואף יותר</p>
      ) : null}
      {showPending ? (
        <p className="mt-2 text-sm text-muted">
          ממתין לתשלום: {formatGiftAmount(pendingAmount)}
        </p>
      ) : null}
    </div>
  );
}
