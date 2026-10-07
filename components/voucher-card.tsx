import { formatGiftAmount } from "@/lib/guest-draft";
import {
  formatVoucherWhen,
  methodTermLabel,
  partialTermLabel,
  redemptionChannelLabel,
  topupTermLabel,
  validityTermLabel,
  voucherStatusLabel,
} from "@/lib/vouchers/labels";
import type { VoucherCardModel } from "@/lib/vouchers/types";
import VoucherShareActions from "@/components/voucher-share-actions";

function statusClass(status: VoucherCardModel["status"]) {
  if (status === "ISSUED") {
    return "bg-white/20 text-white";
  }
  if (status === "PARTIALLY_REDEEMED") {
    return "bg-white text-brand";
  }
  return "bg-white/80 text-foreground";
}

export default function VoucherCard({ model }: { model: VoucherCardModel }) {
  const balanceDiffers = model.remainingAmount !== model.amount;
  return (
    <article className="voucher-print overflow-hidden rounded-[2rem] border border-border bg-white shadow-[0_20px_60px_rgba(76,29,149,0.12)]">
      <div className="bg-gradient-to-l from-[#4c1d95] via-brand to-[#c084fc] px-6 py-7 text-white">
        <div className="flex items-center justify-between gap-3">
          <p className="text-2xl font-extrabold tracking-[0.28em]">LOLO</p>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(model.status)}`}>
            {voucherStatusLabel(model.status)}
          </span>
        </div>
        <p className="mt-8 text-sm text-white/80">שובר מתנה</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">{formatGiftAmount(model.amount)}</p>
        {balanceDiffers ? (
          <p className="mt-2 text-sm text-white/90">
            יתרה למימוש {formatGiftAmount(model.remainingAmount)}
          </p>
        ) : (
          <p className="mt-2 text-sm text-white/80">הסכום המלא זמין למימוש</p>
        )}
      </div>

      <div className="flex flex-col gap-6 px-6 py-6">
        <div className="flex items-center gap-4">
          {model.storeLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={model.storeLogoUrl}
              alt=""
              className="h-16 w-16 rounded-2xl border border-border object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-2xl font-bold text-brand">
              {model.storeName.slice(0, 1)}
            </span>
          )}
          <div>
            <p className="text-sm text-muted">בית העסק</p>
            <p className="text-xl font-bold text-foreground">{model.storeName}</p>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted">המתנה</p>
          <p className="text-lg font-semibold text-foreground">{model.giftTitle}</p>
          {model.eventTitle ? (
            <p className="mt-1 text-sm text-muted">{model.eventTitle}</p>
          ) : null}
        </div>

        <div className="rounded-3xl bg-brand-soft/60 px-4 py-5 text-center">
          <p className="text-sm text-muted">קוד השובר</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-[0.18em] text-foreground" dir="ltr">
            {model.code}
          </p>
        </div>

        {model.qrSvg.includes("<svg") ? (
          <div className="mx-auto w-full max-w-[240px] rounded-3xl border border-border bg-white p-3">
            <div
              className="[&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: model.qrSvg }}
            />
          </div>
        ) : null}

        <dl className="grid gap-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">תוקף</dt>
            <dd className="text-left font-semibold">{formatVoucherWhen(model.expiresAt)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">משך התוקף</dt>
            <dd className="font-semibold">{validityTermLabel(model.terms)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">מימוש</dt>
            <dd className="font-semibold">{partialTermLabel(model.terms)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">השלמה בחנות</dt>
            <dd className="font-semibold">{topupTermLabel(model.terms)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">דרך מימוש</dt>
            <dd className="font-semibold">{methodTermLabel(model.terms)}</dd>
          </div>
        </dl>

        <section>
          <h2 className="text-base font-bold text-foreground">מימושים</h2>
          {model.redemptions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">עדיין אין מימושים.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {model.redemptions.map((redemption) => (
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

        <VoucherShareActions shareUrl={model.shareUrl} />
      </div>
    </article>
  );
}
