"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
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

export default function ThankYouView() {
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const [eventName, setEventName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [contributions, setContributions] = useState<GuestContribution[]>([]);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!slug) {
        return;
      }

      const stored = await getEventBySlug(slug);
      const order = await loadPendingGuestOrder(slug);
      const local = loadContributions(slug);

      if (cancelled) {
        return;
      }

      setEventName(stored?.title ?? "");
      setGuestName(order?.guestName || loadGuestDetails(slug).name);
      if (order) {
        setContributions(
          order.items.map((item) => ({
            giftId: item.giftId,
            giftName: item.giftName,
            amount: item.amount,
          })),
        );
        setTotal(order.totalAmount);
      } else {
        setContributions(local);
        setTotal(getContributionsTotal(local));
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!ready) {
    return null;
  }

  return (
    <div className="mt-8 flex flex-col">
      <div className="rounded-3xl border border-border bg-white px-5 py-6 text-center">
        <p className="text-base font-bold text-brand">ממתינים לתשלום</p>
        {eventName ? (
          <p className="mt-3 text-lg font-bold text-foreground">{eventName}</p>
        ) : null}
        {guestName ? (
          <p className="mt-1 text-sm text-muted">מאת {guestName}</p>
        ) : null}
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {contributions.map((item) => (
            <li
              key={item.giftId}
              className="flex items-center justify-between gap-3 text-foreground"
            >
              <span>{item.giftName}</span>
              <span className="font-semibold">
                {formatGiftAmount(item.amount)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xl font-bold text-brand">
          סה״כ {formatGiftAmount(total)}
        </p>
        <p className="mt-5 text-sm leading-relaxed text-foreground">
          ההזמנה נשמרה. התשלום עדיין לא בוצע — ספק התשלום יחובר בשלב הבא.
        </p>
      </div>
      <Link
        href={guestEventPath(slug)}
        className="mt-8 inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover"
      >
        חזרה לאירוע
      </Link>
    </div>
  );
}
