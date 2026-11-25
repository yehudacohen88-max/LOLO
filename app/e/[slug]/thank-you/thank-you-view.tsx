"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getEventBySlug, guestEventPath } from "@/lib/events";
import { DEMO_EVENT_SLUG, DEMO_SAMPLE_FUNDING } from "@/lib/events/demo";
import { fromRouteParam } from "@/lib/events/slug";
import {
  formatGiftAmount,
  loadContributions,
  saveContributions,
  type GuestContribution,
} from "@/lib/guest-draft";
import { clearGuestOrderRef, loadGuestOrderRef } from "@/lib/orders/guest-ref";
import { requestGuestRefund } from "@/lib/orders/guest-refund";
import {
  guestCanCancel,
  guestCanRequestRefund,
  guestCancelLine,
  guestPaymentStatusLabel,
  guestRefundLine,
  guestRefundRemaining,
} from "@/lib/orders/guest-status";
import { thankYouAfterLoad } from "@/lib/orders/thank-you-ref";
import type { StoredOrder } from "@/lib/orders/types";
import { cancelGuestCheckout } from "@/lib/payments/guest-client";
import { resolveEventCover, resolveGiftImage, type ResolvedImage } from "@/lib/image-library";
import { userFacingMessage } from "@/app/design/user-error";
import { GiftFallback } from "../flagship-ui";
import { JourneyFrame } from "../journey-photo";
import { giftProgressCopy, participationLine } from "../progress-copy";
import styles from "../flagship.module.css";

type OrderRead =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "none" }
  | { phase: "ready"; order: StoredOrder };

async function readServerOrder(slug: string): Promise<Exclude<OrderRead, { phase: "loading" }>> {
  if (!slug || slug === DEMO_EVENT_SLUG) {
    return { phase: "none" };
  }

  const ref = loadGuestOrderRef(slug);
  if (!ref) {
    return { phase: "none" };
  }

  try {
    const params = new URLSearchParams({
      id: ref.id,
      accessToken: ref.accessToken,
    });
    const response = await fetch(`/api/orders?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { phase: "error" };
    }
    return { phase: "ready", order: (await response.json()) as StoredOrder };
  } catch {
    return { phase: "error" };
  }
}

function statusText(read: OrderRead) {
  if (read.phase === "loading") {
    return "בודקים את סטטוס התשלום בשרת...";
  }
  if (read.phase === "error") {
    return "לא הצלחנו לקרוא את סטטוס התשלום מהשרת.";
  }
  if (read.phase === "none") {
    return "עדיין אין אישור תשלום מהשרת.";
  }
  return guestPaymentStatusLabel(read.order);
}

export default function ThankYouView() {
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const [eventName, setEventName] = useState("");
  const [heroGift, setHeroGift] = useState("");
  const [contributions, setContributions] = useState<GuestContribution[]>([]);
  const [feeAmount, setFeeAmount] = useState(0);
  const [chargedAmount, setChargedAmount] = useState(0);
  const [orderRead, setOrderRead] = useState<OrderRead>({ phase: "loading" });
  const [hero, setHero] = useState<ResolvedImage | null>(null);
  const [heroIsGift, setHeroIsGift] = useState(false);
  const [together, setTogether] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const refundKey = useRef("");
  const confirmedPaid = useRef(false);

  function eventUrl() {
    return `${window.location.origin}${guestEventPath(slug)}`;
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!slug) {
        return;
      }

      const local = loadContributions(slug);
      setHeroGift(local[0]?.giftName ?? "");

      const [stored, read] = await Promise.all([
        getEventBySlug(slug),
        readServerOrder(slug),
      ]);
      if (cancelled) {
        return;
      }

      const decision = thankYouAfterLoad(
        read.phase === "ready"
          ? { ok: true, paymentStatus: read.order.paymentStatus }
          : { ok: false },
        confirmedPaid.current,
      );
      if (decision.confirmedPaid) {
        confirmedPaid.current = true;
      }

      const order = read.phase === "ready" ? read.order : null;
      if (order && decision.replaceDisplay) {
        setEventName(stored?.title ?? "");
        setContributions(
          order.items.map((item) => ({
            giftId: item.giftId,
            giftName: item.giftName,
            amount: item.amount,
          })),
        );
        const fee = order.feeAmount ?? 0;
        const contribution = order.contributionAmount ?? 0;
        const charged = order.chargedAmount ?? order.totalAmount ?? contribution + fee;
        setFeeAmount(fee);
        setChargedAmount(Number.isFinite(charged) ? charged : 0);
        setOrderRead(read);
      } else if (read.phase === "error" && !decision.confirmedPaid) {
        setOrderRead({ phase: "error" });
      } else if (decision.confirmedPaid && read.phase !== "ready") {
        setOrderRead({ phase: "error" });
      } else if (!decision.replaceDisplay) {
        setOrderRead(read);
      } else {
        setEventName(stored?.title ?? "");
        setOrderRead(read.phase === "ready" ? read : { phase: "none" });
      }

      if (decision.clearRef) {
        clearGuestOrderRef(slug);
        saveContributions(slug, []);
      }

      const gifts = [...(stored?.gifts ?? [])].filter((item) => item.active !== false);
      const chosenId = (order?.items?.[0]?.giftId || local[0]?.giftId) ?? "";
      const pictured =
        gifts.find((item) => item.id === chosenId) ??
        [...gifts].sort((a, b) => a.priority - b.priority)[0];
      if (!cancelled && stored) {
        setEventName((current) => current || stored.title);
        const giftVisual = resolveGiftImage({
          hostImageUrl: pictured?.imageUrl || "",
          title: pictured?.title || local[0]?.giftName || "",
          description: pictured?.description || "",
          alt: pictured?.title || local[0]?.giftName || stored.title,
        });
        const coverVisual = resolveEventCover({
          hostImageUrl: stored.coverImage,
          eventType: stored.eventType,
          title: stored.title,
          alt: stored.title,
        });
        const usingGift = Boolean(giftVisual.src);
        setHeroIsGift(usingGift);
        setHero(usingGift ? giftVisual : coverVisual.src ? coverVisual : null);
        setHeroGift((current) => current || pictured?.title || "");
      }

      if (slug === DEMO_EVENT_SLUG) {
        const sampleGift = gifts.find((item) => item.id === DEMO_SAMPLE_FUNDING.giftId) ?? pictured;
        setTogether(
          participationLine(
            giftProgressCopy({
              raisedAmount: DEMO_SAMPLE_FUNDING.raisedAmount,
              contributorCount: DEMO_SAMPLE_FUNDING.contributorCount,
              percentOfTarget: DEMO_SAMPLE_FUNDING.percentOfTarget,
              targetAmount: sampleGift && sampleGift.targetAmount > 0 ? sampleGift.targetAmount : null,
            }),
          ),
        );
        return;
      }

      const gift = pictured;
      if (!gift) {
        return;
      }
      try {
        const response = await fetch(`/api/events/${encodeURIComponent(slug)}/funding`, {
          cache: "no-store",
        });
        if (!response.ok || cancelled) {
          return;
        }
        const body = (await response.json()) as {
          gifts?: Array<{
            giftId: string;
            raisedAmount: number;
            contributorCount: number;
            percentOfTarget: number | null;
          }>;
        };
        const row = body.gifts?.find((item) => item.giftId === gift.id);
        if (row && !cancelled) {
          setTogether(
            participationLine(
              giftProgressCopy({
                raisedAmount: Number(row.raisedAmount),
                contributorCount: Number(row.contributorCount),
                percentOfTarget:
                  row.percentOfTarget == null ? null : Number(row.percentOfTarget),
                targetAmount: gift.targetAmount > 0 ? gift.targetAmount : null,
              }),
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setTogether("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const order = orderRead.phase === "ready" ? orderRead.order : null;
  const paid = order?.paymentStatus === "paid";
  const failed = order?.paymentStatus === "failed";
  const unpaid = order ? guestCanCancel(order) : false;
  const refundNote = guestRefundLine(order);
  const cancelNote = guestCancelLine(order);
  const canRefund = order ? guestCanRequestRefund(order) : false;
  const refundDefault = order ? String(guestRefundRemaining(order)) : "";
  const showReceiptAmounts = orderRead.phase === "ready";
  const giftLabel = contributions[0]?.giftName || heroGift || eventName || "המתנה";
  const shareText = eventName ? `בואו לחגוג: ${eventName}` : "בואו לחגוג ב-LOLO";
  const progressLine = together
    .split(" · ")
    .filter((part) => !part.includes("%"))
    .join(" · ");

  async function cancelOrder() {
    if (!order || cancelling || !unpaid) {
      return;
    }
    setCancelling(true);
    setCancelError("");
    try {
      const next = await cancelGuestCheckout(order.id, order.accessToken);
      setOrderRead({ phase: "ready", order: next });
    } catch (error) {
      setCancelError(userFacingMessage(error, "לא ניתן לבטל את ההזמנה."));
    } finally {
      setCancelling(false);
    }
  }

  async function reloadOrder() {
    const next = await readServerOrder(slug);
    if (next.phase === "ready") {
      setOrderRead(next);
      return true;
    }
    return false;
  }

  async function refundOrder(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!order || refunding || !canRefund) {
      return;
    }
    const amount = Number(refundAmount || refundDefault);
    if (!(amount > 0)) {
      setRefundError("סכום ההחזר אינו תקין.");
      return;
    }
    if (!refundKey.current) {
      refundKey.current = crypto.randomUUID();
    }
    setRefunding(true);
    setRefundError("");
    try {
      await requestGuestRefund({
        orderId: order.id,
        accessToken: order.accessToken,
        amount,
        idempotencyKey: refundKey.current,
      });
      const refreshed = await reloadOrder();
      if (refreshed) {
        refundKey.current = "";
        setRefundAmount("");
      } else {
        setRefundError("ההחזר נרשם, אבל לא הצלחנו לרענן את הסטטוס.");
      }
    } catch (error) {
      setRefundError(userFacingMessage(error, "לא ניתן לרשום את ההחזר."));
    } finally {
      setRefunding(false);
    }
  }

  async function shareEvent() {
    const payload = { title: eventName || "LOLO", text: shareText, url: eventUrl() };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }
    setShareNote("fallback");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(eventUrl());
      setShareNote("copied");
    } catch {
      setShareNote("fallback");
    }
  }

  return (
    <div className={styles.thanksLayout} data-journey-thanks="" data-reveal="">
      {hero ? (
        <figure data-journey-hero="" data-journey-thanks-photo="">
          <JourneyFrame image={hero} gift={heroIsGift} thanks />
        </figure>
      ) : null}
      <div className={styles.thanksMain} data-journey-thanks-main="">
        <div className={`${styles.card} ${styles.thanksReceipt}`} data-journey-panel="">
          {hero ? null : <GiftFallback compact />}
          <p className={styles.revealCard} data-reveal-card="">
            {giftLabel}
          </p>
          {showReceiptAmounts ? (
            <p className={styles.thanksAmount} data-journey-amount="">
              {formatGiftAmount(chargedAmount)}
            </p>
          ) : null}
          {orderRead.phase === "loading" ? (
            <div className={styles.skeleton} aria-busy="true">
              <span className={styles.srOnly} data-order-status="" role="status">
                {statusText(orderRead)}
              </span>
            </div>
          ) : (
            <p className={styles.orderStatus} data-order-status="" data-journey-status="" role="status">
              {statusText(orderRead)}
            </p>
          )}
          {eventName ? <p className={styles.quietLine}>{eventName}</p> : null}
          <p className={styles.notice} data-journey-demo="">
            תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי
          </p>
          <details className={styles.demoDetails}>
            <summary className={styles.quietLine}>פרטי הדגמה</summary>
            {showReceiptAmounts ? (
              <>
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
              </>
            ) : null}
            {progressLine ? <p className={styles.quietLine}>{progressLine}</p> : null}
            {order?.paymentReference ? (
              <p className={styles.quietLine} dir="ltr">
                {order.paymentReference}
              </p>
            ) : null}
            <p className={styles.quietLine}>בשלב זה לא מונפק שובר אמיתי.</p>
          </details>
          {paid ? (
            <p className={styles.quietLine}>ההשתתפות נוספה למתנה. תודה שחגגתם יחד.</p>
          ) : null}
          {refundNote ? (
            <p className={styles.quietLine} data-refund-status="" role="status">
              {refundNote}
            </p>
          ) : null}
          {typeof order?.refundedAmount === "number" && order.refundedAmount > 0 ? (
            <p className={styles.quietLine} data-refund-amount="">
              סכום שנרשם להחזר: {formatGiftAmount(order.refundedAmount)}. לא הועבר כסף אמיתי.
            </p>
          ) : null}
          {cancelNote ? (
            <p className={styles.quietLine} data-cancel-status="" role="status">
              {cancelNote}
            </p>
          ) : null}
          {failed ? (
            <p className={styles.quietLine}>אפשר לחזור ולנסות שוב. לא בוצע חיוב.</p>
          ) : null}
          {canRefund ? (
            <form className={styles.stack} onSubmit={(event) => void refundOrder(event)}>
              <p className={styles.quietLine}>
                בקשת החזר בהדגמה. לא מועבר כסף אמיתי. אם מדיניות ההחזרים לא הוגדרה, הבקשה תידחה.
              </p>
              <label className={styles.field}>
                <span className={styles.srOnly}>סכום להחזר</span>
                <input
                  inputMode="decimal"
                  value={refundAmount || refundDefault}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  aria-label="סכום להחזר"
                />
              </label>
              <button type="submit" className={styles.ghost} disabled={refunding} data-refund-request="">
                בקשת החזר
              </button>
            </form>
          ) : null}
          {cancelError ? (
            <p className={styles.fieldError} role="alert" data-cancel-error="">
              {cancelError}
            </p>
          ) : null}
          {refundError ? (
            <p className={styles.fieldError} role="alert" data-refund-error="">
              {refundError}
            </p>
          ) : null}
          {orderRead.phase === "error" ? (
            <p className={styles.fieldError} role="alert" data-order-error="">
              לא הצלחנו לקרוא את סטטוס ההזמנה. אפשר לרענן ולנסות שוב.
            </p>
          ) : null}
        </div>
        <div className={styles.shareRow}>
          <button
            type="button"
            className={styles.cta}
            data-journey-cta=""
            onClick={() => {
              window.open(
                `https://wa.me/?text=${encodeURIComponent(`${shareText} ${eventUrl()}`)}`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            שיתוף בוואטסאפ
          </button>
          <button
            type="button"
            className={styles.ghost}
            data-journey-stage-quiet=""
            onClick={() => void shareEvent()}
          >
            שיתוף בדרך אחרת
          </button>
          <button type="button" className={styles.ghost} data-journey-stage-quiet="" onClick={() => void copyLink()}>
            העתקת קישור
          </button>
          {unpaid ? (
            <button
              type="button"
              className={styles.ghost}
              data-journey-stage-quiet=""
              disabled={cancelling}
              onClick={() => {
                void cancelOrder();
              }}
            >
              ביטול ההזמנה
            </button>
          ) : null}
          {failed ? (
            <Link href={guestEventPath(slug, "payment")} className={styles.ghost} data-journey-stage-quiet="">
              חזרה לתשלום
            </Link>
          ) : (
            <Link href={guestEventPath(slug)} className={styles.ghost} data-journey-stage-quiet="">
              חזרה לאירוע
            </Link>
          )}
        </div>
        {shareNote === "copied" ? (
          <p className={styles.quietLine} role="status">
            הקישור הועתק
          </p>
        ) : null}
      </div>
    </div>
  );
}
