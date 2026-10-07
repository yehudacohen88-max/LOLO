"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventBySlug, guestEventPath } from "@/lib/events";
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
import {
  confirmGuestCheckout,
  fetchCheckoutQuote,
  startGuestCheckout,
} from "@/lib/payments/guest-client";
import type { CheckoutQuote, PaymentOutcome } from "@/lib/payments/types";

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function GuestPaymentSummary() {
  const router = useRouter();
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const [eventName, setEventName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [greeting, setGreeting] = useState("");
  const [contributions, setContributions] = useState<GuestContribution[]>([]);
  const [ready, setReady] = useState(false);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [phase, setPhase] = useState<"form" | "processing" | "success">("form");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!slug) {
        return;
      }

      const stored = await getEventBySlug(slug);
      const loaded = loadContributions(slug);
      if (cancelled) {
        return;
      }

      setEventName(stored?.title ?? "");
      setGuestName(loadGuestDetails(slug).name);
      setGreeting(loadGuestGreeting(slug).text);
      setContributions(loaded);
      setReady(true);

      if (loaded.length === 0) {
        return;
      }

      try {
        const nextQuote = await fetchCheckoutQuote(
          slug,
          loaded.map((item) => ({ giftId: item.giftId, amount: item.amount })),
        );
        if (!cancelled) {
          setQuote(nextQuote);
        }
      } catch (error) {
        if (!cancelled) {
          setQuoteError(
            error instanceof Error
              ? error.message
              : "לא ניתן לחשב את הסכום לתשלום.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!ready) {
    return <p className="mt-10 text-center text-base text-muted">טוענים את התשלום...</p>;
  }

  const localTotal = getContributionsTotal(contributions);
  const contributionAmount = quote?.contributionAmount ?? localTotal;
  const feeAmount = quote?.feeAmount ?? 0;
  const chargedAmount = quote?.chargedAmount ?? localTotal;
  const showDemo = quote ? quote.isDemo : true;
  const unavailable = quote != null && !quote.isDemo;

  async function pay(outcome: PaymentOutcome) {
    if (phase !== "form") {
      return;
    }
    setPhase("processing");
    setActionError("");
    const startedAt = Date.now();

    try {
      const order = await savePendingGuestOrder(slug);
      if (!order) {
        throw new Error("תשלום הדגמה זמין באירוע שפורסם.");
      }

      const started = await startGuestCheckout(order.id, order.accessToken);
      if (started.checkoutUrl) {
        window.location.assign(started.checkoutUrl);
        return;
      }
      if (started.status === "paid") {
        setPhase("success");
        router.push(guestEventPath(slug, "thank-you"));
        return;
      }
      if (!started.isDemo || started.status === "unavailable") {
        throw new Error("אמצעי התשלום אינו זמין כרגע.");
      }

      const confirmed = await confirmGuestCheckout(
        order.id,
        order.accessToken,
        outcome,
      );
      const elapsed = Date.now() - startedAt;
      if (elapsed < 800) {
        await delay(800 - elapsed);
      }

      if (confirmed.paymentStatus === "paid") {
        setPhase("success");
        await delay(500);
        router.push(guestEventPath(slug, "thank-you"));
        return;
      }

      setPhase("form");
      setActionError("התשלום לא הושלם. אפשר לנסות שוב.");
    } catch (error) {
      setPhase("form");
      setActionError(
        error instanceof Error ? error.message : "התשלום לא הושלם. אפשר לנסות שוב.",
      );
    }
  }

  if (contributions.length === 0 || localTotal <= 0) {
    return (
      <div className="mt-10 rounded-3xl border border-border bg-white p-5 text-center">
        <p className="text-base text-foreground">עדיין לא נבחרה מתנה.</p>
        <Link
          href={guestEventPath(slug)}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover"
        >
          חזרה לבחירת מתנה
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-10 flex flex-col gap-6" aria-busy={phase === "processing"}>
      <section className="rounded-3xl border border-border bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-foreground">סיכום התשלום</h2>
          {showDemo && !unavailable ? (
            <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
              תשלום הדגמה
            </span>
          ) : null}
        </div>
        {showDemo && !unavailable ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            זהו תשלום הדגמה. לא נגבה כסף אמיתי, ולא מתבקש מספר כרטיס אשראי.
          </p>
        ) : null}
        {eventName ? <p className="mt-4 text-sm font-semibold text-foreground">{eventName}</p> : null}
        {guestName ? <p className="mt-1 text-sm text-muted">{guestName}</p> : null}
        {greeting ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">“{greeting}”</p>
        ) : null}

        <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
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

        <dl className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">השתתפות במתנה</dt>
            <dd className="font-semibold text-foreground">
              {formatGiftAmount(contributionAmount)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">
              {feeAmount > 0 ? "עמלת שירות" : "ללא עמלת שירות"}
            </dt>
            {feeAmount > 0 ? (
              <dd className="font-semibold text-foreground">{formatGiftAmount(feeAmount)}</dd>
            ) : null}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-lg">
            <dt className="font-bold text-foreground">סה״כ לחיוב</dt>
            <dd className="font-bold text-brand">{formatGiftAmount(chargedAmount)}</dd>
          </div>
        </dl>
        {!quote && !quoteError ? (
          <p className="mt-3 text-sm text-muted">מחשבים את הסכום...</p>
        ) : null}
      </section>

      {quoteError ? <p className="text-center text-sm text-brand">{quoteError}</p> : null}
      {actionError ? <p className="text-center text-sm text-brand">{actionError}</p> : null}

      {unavailable ? (
        <p className="rounded-3xl border border-border bg-white px-5 py-4 text-center text-sm leading-relaxed text-muted">
          אמצעי התשלום אינו זמין כרגע.
        </p>
      ) : null}

      {phase === "processing" ? (
        <p className="text-center text-sm font-semibold text-brand">
          מאשרים את תשלום ההדגמה...
        </p>
      ) : null}
      {phase === "success" ? (
        <p className="text-center text-base font-bold text-brand">התשלום התקבל</p>
      ) : null}

      {phase === "form" && !unavailable ? (
        <>
          <button
            type="button"
            disabled={!quote || Boolean(quoteError)}
            onClick={() => {
              void pay("success");
            }}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover disabled:bg-brand/40"
          >
            אישור תשלום הדגמה
          </button>
          <button
            type="button"
            disabled={!quote || Boolean(quoteError)}
            onClick={() => {
              void pay("failure");
            }}
            className="text-center text-sm font-semibold text-muted underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40"
          >
            הדמיית תשלום שנכשל
          </button>
          <p className="text-center text-xs text-muted">לבדיקה בלבד. לא מתבצע חיוב אמיתי.</p>
        </>
      ) : null}
    </div>
  );
}
