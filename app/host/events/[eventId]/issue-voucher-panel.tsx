"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatGiftAmount } from "@/lib/guest-draft";
import { formatFundingPercent } from "@/lib/funding/labels";
import {
  methodTermLabel,
  partialTermLabel,
  topupTermLabel,
  validityTermLabel,
  voucherStatusLabel,
} from "@/lib/vouchers/labels";
import type { HostDashboardGift } from "@/lib/host/dashboard";
import type { VoucherStoreOption } from "@/lib/vouchers/types";

type IssueVoucherPanelProps = {
  eventId: string;
  gift: HostDashboardGift;
  stores: VoucherStoreOption[];
};

export default function IssueVoucherPanel({
  eventId,
  gift,
  stores,
}: IssueVoucherPanelProps) {
  const router = useRouter();
  const fixedStore = gift.storeId
    ? stores.find((store) => store.id === gift.storeId) ?? null
    : null;
  const [storeId, setStoreId] = useState(fixedStore?.id ?? "");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef("");

  const selected = fixedStore ?? stores.find((store) => store.id === storeId) ?? null;
  const needsChoice = !fixedStore;
  const canStart = gift.availableAmount > 0 && (Boolean(fixedStore) || stores.length > 0);
  const issuedBefore = gift.voucheredAmount > 0;

  function openConfirmation() {
    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID();
    }
    setError("");
    setOpen(true);
  }

  async function issue() {
    if (!selected) {
      setError("יש לבחור בית עסק פעיל.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/host/events/${eventId}/vouchers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftId: gift.id,
          storeId: selected.id,
          expectedAmount: gift.availableAmount,
          idempotencyKey: idempotencyKey.current,
          validityDays: selected.terms.validityDays,
          allowPartialRedemption: selected.terms.allowPartialRedemption,
          allowCustomerTopup: selected.terms.allowCustomerTopup,
          redemptionMethod: selected.terms.redemptionMethod,
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "הנפקת השובר נכשלה.");
      }
      router.push(`/host/events/${eventId}/vouchers/${payload.id}`);
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "הנפקת השובר נכשלה.");
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm text-foreground">
        שולם {formatGiftAmount(gift.paidAmount)}
        {" · "}
        בשוברים {formatGiftAmount(gift.voucheredAmount)}
        {" · "}
        זמין להנפקה {formatGiftAmount(gift.availableAmount)}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {issuedBefore
          ? "תשלום שמגיע אחרי הנפקת שובר נשאר פנוי, ואפשר להנפיק עליו שובר נוסף."
          : "אפשר להנפיק שובר על הסכום ששולם גם לפני שהיעד הושלם. תשלום נוסף יישאר פנוי לשובר נוסף."}
      </p>

      {gift.vouchers.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {gift.vouchers.map((voucher) => (
            <li key={voucher.id}>
              <Link
                href={`/host/events/${eventId}/vouchers/${voucher.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-brand-soft/50 px-4 py-3 text-sm"
              >
                <span className="font-semibold">{formatGiftAmount(voucher.amount)}</span>
                <span className="text-muted">
                  {voucher.storeName} · {voucherStatusLabel(voucher.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {gift.availableAmount <= 0 ? (
        <p className="mt-3 text-sm text-muted">
          {gift.paidAmount > 0
            ? "כל הסכום ששולם כבר נמצא בשובר. כשייכנס תשלום חדש אפשר להנפיק שובר נוסף."
            : "עדיין אין סכום ששולם להנפקה."}
        </p>
      ) : null}

      {gift.availableAmount > 0 && needsChoice && stores.length === 0 ? (
        <p className="mt-3 text-sm text-muted">אין כרגע בית עסק פעיל שאפשר לשייך לשובר.</p>
      ) : null}

      {canStart && !open ? (
        <button
          type="button"
          onClick={openConfirmation}
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover"
        >
          {issuedBefore ? "הנפקת שובר נוסף" : "הנפקת שובר"}
        </button>
      ) : null}

      {open ? (
        <section className="mt-4 rounded-3xl border border-brand/30 bg-brand-soft/30 p-4">
          <h3 className="text-base font-bold text-foreground">אישור הנפקת שובר</h3>
          <p className="mt-3 text-3xl font-bold text-brand">
            {formatGiftAmount(gift.availableAmount)}
          </p>
          {gift.targetAmount ? (
            <p className="mt-1 text-sm text-muted">
              מתוך יעד {formatGiftAmount(gift.targetAmount)}
              {gift.percentOfTarget != null
                ? ` · ${formatFundingPercent(gift.percentOfTarget)} מהיעד`
                : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">אין יעד למתנה. השובר הוא על הסכום ששולם.</p>
          )}
          {gift.percentOfTarget != null && gift.percentOfTarget < 100 ? (
            <p className="mt-2 text-sm font-semibold text-foreground">
              היעד עדיין לא הושלם. השובר יונפק על הסכום ששולם בלבד.
            </p>
          ) : null}
          {gift.pendingAmount > 0 ? (
            <p className="mt-2 text-sm text-muted">
              סכום שממתין לתשלום לא נכלל: {formatGiftAmount(gift.pendingAmount)}
            </p>
          ) : null}

          {needsChoice ? (
            <label className="mt-4 flex flex-col gap-2">
              <span className="text-sm font-semibold">בית העסק למימוש</span>
              {gift.storeId ? (
                <span className="text-sm text-muted">
                  בית העסק המקורי אינו פעיל. בחרו בית עסק פעיל.
                </span>
              ) : (
                <span className="text-sm text-muted">למתנה לא שויך בית עסק. בחרו לאן השובר שייך.</span>
              )}
              <select
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                className="h-12 rounded-2xl border border-border bg-white px-4 text-base outline-none focus:border-brand"
              >
                <option value="">בחירה</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="mt-4 text-sm">
              <span className="text-muted">בית העסק: </span>
              <span className="font-semibold">{selected?.name}</span>
            </p>
          )}

          {selected ? (
            <ul className="mt-4 flex flex-col gap-1 text-sm text-foreground">
              <li>תוקף: {validityTermLabel(selected.terms)} מההנפקה</li>
              <li>{partialTermLabel(selected.terms)}</li>
              <li>{topupTermLabel(selected.terms)}</li>
              <li>דרך מימוש: {methodTermLabel(selected.terms)}</li>
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">בחרו בית עסק כדי לראות את תנאי השובר.</p>
          )}
          <p className="mt-3 text-sm text-muted">
            ההנפקה לא עוצרת תרומות חדשות. מה שישולם אחר כך יישאר זמין לשובר נוסף.
          </p>

          {error ? <p className="mt-3 text-sm text-brand">{error}</p> : null}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={issue}
              disabled={saving || !selected}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-brand px-5 text-base font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {saving ? "מנפיקים..." : "אישור והנפקת שובר"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-border bg-white px-5 text-base font-semibold"
            >
              ביטול
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
