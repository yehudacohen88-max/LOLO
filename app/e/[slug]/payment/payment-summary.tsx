"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventBySlug } from "@/lib/events";
import { fromRouteParam } from "@/lib/events/slug";
import {
  formatGiftAmount,
  getContributionsTotal,
  loadContributions,
  loadGuestDetails,
  loadGuestGreeting,
  type GuestContribution,
} from "@/lib/guest-draft";
import { savePendingGuestOrder } from "@/lib/orders/client";
import { startGuestPayment } from "@/lib/payments/start-guest-payment";

export default function GuestPaymentSummary() {
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const [eventName, setEventName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [greeting, setGreeting] = useState("");
  const [contributions, setContributions] = useState<GuestContribution[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [pendingSaved, setPendingSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!slug) {
        return;
      }

      const stored = await getEventBySlug(slug);
      if (cancelled) {
        return;
      }

      setEventName(stored?.title ?? "");
      setGuestName(loadGuestDetails(slug).name);
      setGreeting(loadGuestGreeting(slug).text);
      setContributions(loadContributions(slug));
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!ready) {
    return null;
  }

  const total = getContributionsTotal(contributions);

  return (
    <div className="mt-10 flex flex-col gap-6">
      <div className="rounded-3xl border border-border bg-white p-5">
        <h2 className="text-base font-bold text-foreground">סיכום המתנה</h2>
        {eventName ? (
          <p className="mt-1 text-sm text-muted">{eventName}</p>
        ) : null}
        {guestName ? (
          <p className="mt-1 text-sm text-foreground">{guestName}</p>
        ) : null}
        {greeting ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">“{greeting}”</p>
        ) : null}
        <ul className="mt-4 flex flex-col gap-2">
          {contributions.map((item) => (
            <li
              key={item.giftId}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="font-medium text-foreground">{item.giftName}</span>
              <span className="font-semibold text-foreground">
                {formatGiftAmount(item.amount)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-lg font-bold text-brand">
          סה״כ לתשלום {formatGiftAmount(total)}
        </p>
      </div>

      {saveError ? (
        <p className="text-center text-sm text-brand">{saveError}</p>
      ) : null}
      {pendingSaved ? (
        <p className="text-center text-sm font-medium text-brand">
          ההזמנה נשמרה וממתינה לתשלום
        </p>
      ) : null}

      <button
        type="button"
        disabled={saving || total <= 0}
        onClick={async () => {
          try {
            setSaving(true);
            setSaveError("");
            const order = await savePendingGuestOrder(slug);
            if (order) {
              await startGuestPayment(order);
            }
            setPendingSaved(true);
          } catch (error) {
            setSaveError(
              error instanceof Error ? error.message : "שמירת ההזמנה נכשלה.",
            );
          } finally {
            setSaving(false);
          }
        }}
        className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand/40"
      >
        לתשלום
      </button>
      <p className="text-center text-sm text-muted">
        ספק התשלום יחובר בשלב הבא. ההזמנה נשמרת כממתינה לתשלום.
      </p>
    </div>
  );
}
