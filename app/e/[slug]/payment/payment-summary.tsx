"use client";

/* Host-uploaded gift images are not covered by next/image remote patterns. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useContext, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getEventBySlug, guestEventPath } from "@/lib/events";
import { fromRouteParam } from "@/lib/events/slug";
import {
  formatGiftAmount,
  getContributionsTotal,
  loadContributions,
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
import { readContinuity, subscribeContinuity } from "../continuity";
import { GuestPaySlotContext } from "../flow-page";
import { GiftFallback } from "../flagship-ui";
import styles from "../flagship.module.css";

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function GuestPaymentSummary() {
  const router = useRouter();
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const paySlot = useContext(GuestPaySlotContext);
  const [eventName, setEventName] = useState("");
  const [hostName, setHostName] = useState("");
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
      setHostName(stored?.hostName ?? "");
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

  const mark = useSyncExternalStore(
    subscribeContinuity,
    () => (slug ? readContinuity(slug) : null),
    () => null,
  );

  if (!ready) {
    return <p className={styles.quietLine}>טוענים את התשלום...</p>;
  }

  const localTotal = getContributionsTotal(contributions);
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
      <div className={styles.card}>
        <p className={styles.notice}>תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי</p>
        <p>עדיין לא נבחרה מתנה.</p>
        <Link href={guestEventPath(slug)} className={styles.cta}>
          חזרה לבחירת מתנה
        </Link>
      </div>
    );
  }

  const sideImage = mark?.giftImage || "";
  const hero = (
    <div className={styles.payHero} data-pay-hero="">
      {sideImage ? (
        <img className={styles.payThumb} src={sideImage} alt="" width={72} height={72} data-gift-photo="" />
      ) : (
        <GiftFallback compact />
      )}
      <p className={styles.revealCard} data-reveal-card="">
        {contributions[0]?.giftName || mark?.giftName || "המתנה"}
      </p>
      {eventName ? <p className={styles.quietLine}>{eventName}</p> : null}
      {hostName ? <p className={styles.payHost}>מאת {hostName}</p> : null}
      {greeting ? <p className={styles.payQuote}>״{greeting}״</p> : null}
      {mark?.progress ? <p className={styles.payProgress}>{mark.progress}</p> : null}
    </div>
  );

  return (
    <>
    {paySlot ? createPortal(hero, paySlot) : null}
    <div className={styles.flowBody} aria-busy={phase === "processing"}>
      <section className={styles.card}>
        <h2>סיכום התשלום</h2>
        {showDemo && !unavailable ? (
          <p className={styles.notice}>תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי</p>
        ) : null}
        {contributions.map((item) => (
          <p key={item.giftId} className={styles.lineRow}>
            <span>{item.giftName}</span>
            <b>{formatGiftAmount(item.amount)}</b>
          </p>
        ))}
        <p className={styles.lineRow}>
          <span>{feeAmount > 0 ? "עמלת שירות" : "ללא עמלת שירות"}</span>
          {feeAmount > 0 ? <b>{formatGiftAmount(feeAmount)}</b> : null}
        </p>
        <p className={styles.totalLine}>
          <span>סה״כ לחיוב</span>
          <span>{formatGiftAmount(chargedAmount)}</span>
        </p>
        {!quote && !quoteError ? (
          <p className={styles.quietLine}>מחשבים את הסכום...</p>
        ) : null}
      </section>

      {quoteError ? <p className={styles.fieldError}>{quoteError}</p> : null}
      {actionError ? <p className={styles.fieldError}>{actionError}</p> : null}

      {unavailable ? (
        <p className={styles.card}>אמצעי התשלום אינו זמין כרגע.</p>
      ) : null}

      {phase === "processing" ? (
        <p className={styles.quietLine}>מאשרים את תשלום ההדגמה...</p>
      ) : null}
      {phase === "success" ? <p className={styles.notice}>התשלום התקבל</p> : null}

      {phase === "form" && !unavailable ? (
        <>
          <button
            type="button"
            disabled={!quote || Boolean(quoteError)}
            onClick={() => {
              void pay("success");
            }}
            className={styles.cta}
          >
            אישור תשלום הדגמה
          </button>
          <button
            type="button"
            disabled={!quote || Boolean(quoteError)}
            onClick={() => {
              void pay("failure");
            }}
            className={styles.ghost}
          >
            הדמיית תשלום שנכשל
          </button>
        </>
      ) : null}
    </div>
    </>
  );
}
