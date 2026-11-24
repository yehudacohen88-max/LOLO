import { formatGiftAmount } from "@/lib/guest-draft";
import { formatVoucherWhen, redemptionChannelLabel } from "@/lib/vouchers/labels";
import type { VoucherRedemptionView } from "@/lib/vouchers/types";

export default function VoucherRedemptionList({
  redemptions,
}: {
  redemptions: VoucherRedemptionView[];
}) {
  return (
    <section>
      <h2 className="text-base font-bold text-foreground">מימושים</h2>
      {redemptions.length === 0 ? (
        <p className="mt-2 text-sm text-muted">עדיין אין מימושים.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {redemptions.map((redemption) => (
            <li
              key={redemption.id}
              className="rounded-2xl border border-border px-4 py-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{formatGiftAmount(redemption.amount)}</span>
                <span className="text-muted">{redemptionChannelLabel(redemption.channel)}</span>
              </div>
              <p className="mt-1 text-muted">{formatVoucherWhen(redemption.redeemedAt)}</p>
              {redemption.reference ? (
                <p className="mt-1 text-muted">אסמכתה: {redemption.reference}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
