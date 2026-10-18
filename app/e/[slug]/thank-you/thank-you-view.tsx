"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getEventBySlug, guestEventPath } from "@/lib/events";
import { fromRouteParam } from "@/lib/events/slug";
import {
  formatGiftAmount,
  getContributionsTotal,
  loadContributions,
  loadGuestDetails,
  type GuestContribution,
} from "@/lib/guest-draft";
import { loadPendingGuestOrder } from "@/lib/orders/client";
import { clearGuestOrderRef } from "@/lib/orders/guest-ref";
import { thankYouAfterLoad } from "@/lib/orders/thank-you-ref";
import type { PaymentStatus } from "@/lib/orders/types";

export default function ThankYouView() {
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const [eventName, setEventName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [contributions, setContributions] = useState<GuestContribution[]>([]);
  const [contributionAmount, setContributionAmount] = useState(0);
  const [feeAmount, setFeeAmount] = useState(0);
  const [chargedAmount, setChargedAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">("");
  const [paymentProvider, setPaymentProvider] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shared, setShared] = useState("");
  const confirmedPaid = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!slug) {
        return;
      }

      const stored = await getEventBySlug(slug);
      const order = await loadPendingGuestOrder(slug);
      const local = loadContributions(slug);
      const decision = thankYouAfterLoad(
        order ? { ok: true, paymentStatus: order.paymentStatus } : { ok: false },
        confirmedPaid.current,
      );

      if (cancelled) {
        return;
      }

      if (decision.confirmedPaid) {
        confirmedPaid.current = true;
      }

      if (order && decision.replaceDisplay) {
        setEventName(stored?.title ?? "");
        setGuestName(order.guestName || loadGuestDetails(slug).name);
        setContributions(
          order.items.map((item) => ({
            giftId: item.giftId,
            giftName: item.giftName,
            amount: item.amount,
          })),
        );
        const contribution = order.contributionAmount ?? order.totalAmount;
        const fee = order.feeAmount ?? 0;
        setContributionAmount(contribution);
        setFeeAmount(fee);
        setChargedAmount(order.chargedAmount ?? contribution + fee);
        setPaymentStatus(order.paymentStatus);
        setPaymentProvider(order.paymentProvider ?? null);
        setPaymentReference(order.paymentReference ?? null);
      } else if (decision.replaceDisplay) {
        setEventName(stored?.title ?? "");
        setGuestName(loadGuestDetails(slug).name);
        setContributions(local);
        const total = getContributionsTotal(local);
        setContributionAmount(total);
        setFeeAmount(0);
        setChargedAmount(total);
        setPaymentStatus("");
        setPaymentProvider(null);
        setPaymentReference(null);
      }

      if (decision.clearRef) {
        clearGuestOrderRef(slug);
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!ready) {
    return <p className="mt-8 text-center text-base text-muted">טוענים את פרטי המתנה...</p>;
  }

  const paid = paymentStatus === "paid";
  const failed = paymentStatus === "failed";
  const demoPaid = paid && paymentProvider === "demo";

  async function shareInvitation() {
    const url = `${window.location.origin}${guestEventPath(slug)}`;
    const payload = {
      title: eventName || "LOLO",
      text: "ביחד, אנחנו מגשימים משאלה",
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        setShared("אפשר להעביר את ההזמנה הלאה");
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared("הקישור להזמנה הועתק");
    } catch {
      setShared(url);
    }
  }

  return (
    <div className="mt-8 flex flex-col">
      <div className="gift-scene" aria-hidden>
        <span className="mote" />
        <span className="mote" />
        <span className="mote" />
        <span className="mote" />
        <span className="gift-base" />
        <span className="gift-lid" />
        <span className="gift-bow" />
      </div>
      <div className="lolo-card px-5 py-6 text-center">
        <p className="lolo-demo">גרסת בטא — תשלומים מדומים בלבד</p>
        {paid ? (
          <p className="mt-3 text-base font-bold text-brand">התשלום התקבל</p>
        ) : failed ? (
          <p className="text-base font-bold text-brand">התשלום לא הושלם</p>
        ) : (
          <p className="text-base font-bold text-brand">ממתינים לתשלום</p>
        )}
        {demoPaid ? (
          <p className="mt-2 text-sm font-semibold text-brand">תשלום הדגמה</p>
        ) : null}
        {eventName ? (
          <p className="mt-3 text-lg font-bold text-foreground">{eventName}</p>
        ) : null}
        {guestName ? <p className="mt-1 text-sm text-muted">מאת {guestName}</p> : null}
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {contributions.map((item) => (
            <li
              key={item.giftId}
              className="flex items-center justify-between gap-3 text-foreground"
            >
              <span>{item.giftName}</span>
              <span className="font-semibold">{formatGiftAmount(item.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-1 text-sm">
          <p className="flex items-center justify-between gap-3 text-foreground">
            <span>השתתפות במתנה</span>
            <span className="font-semibold">{formatGiftAmount(contributionAmount)}</span>
          </p>
          <p className="flex items-center justify-between gap-3 text-muted">
            <span>{feeAmount > 0 ? "עמלת שירות" : "ללא עמלת שירות"}</span>
            {feeAmount > 0 ? <span>{formatGiftAmount(feeAmount)}</span> : <span />}
          </p>
        </div>
        <p className="mt-4 text-xl font-bold text-brand">
          {paid ? "שולם" : "סה״כ"} {formatGiftAmount(chargedAmount)}
        </p>
        {demoPaid && paymentReference ? (
          <p className="mt-3 text-xs text-muted" dir="ltr">
            {paymentReference}
          </p>
        ) : null}
        <p className="mt-5 text-sm leading-relaxed text-foreground">
          {paid
            ? "ההשתתפות נוספה למתנה. תודה שחגגתם יחד."
            : failed
              ? "אפשר לחזור ולנסות שוב. לא בוצע חיוב."
              : "ההזמנה נשמרה. התשלום עדיין לא בוצע."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          void shareInvitation();
        }}
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover"
      >
        שתפו את ההזמנה
      </button>
      {shared ? <p className="mt-3 text-center text-sm font-semibold text-brand">{shared}</p> : null}
      {failed ? (
        <Link
          href={guestEventPath(slug, "payment")}
          className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-ivory px-6 text-base font-semibold text-foreground hover:bg-brand-soft"
        >
          חזרה לתשלום
        </Link>
      ) : (
        <Link
          href={guestEventPath(slug)}
          className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-ivory px-6 text-base font-semibold text-foreground hover:bg-brand-soft"
        >
          חזרה לאירוע
        </Link>
      )}
    </div>
  );
}
