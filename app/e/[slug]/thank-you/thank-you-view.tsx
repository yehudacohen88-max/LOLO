"use client";

/* Host and bundled demo image URLs are not covered by next/image remote patterns. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getEventBySlug, guestEventPath } from "@/lib/events";
import { DEMO_EVENT_SLUG, DEMO_SAMPLE_FUNDING } from "@/lib/events/demo";
import { fromRouteParam } from "@/lib/events/slug";
import {
  formatGiftAmount,
  loadContributions,
  loadGuestDetails,
  saveContributions,
  type GuestContribution,
} from "@/lib/guest-draft";
import { clearGuestOrderRef, loadGuestOrderRef } from "@/lib/orders/guest-ref";
import { thankYouAfterLoad } from "@/lib/orders/thank-you-ref";
import type { StoredOrder } from "@/lib/orders/types";
import { BETA_CLARITY } from "@/app/design/beta-notice";
import { EmptyCover, GiftReveal } from "../flagship-ui";
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
  if (read.order.paymentStatus === "paid" && read.order.paymentProvider === "demo") {
    return "שולם בהדגמה";
  }
  if (read.order.paymentStatus === "paid") {
    return "התשלום התקבל";
  }
  if (read.order.paymentStatus === "failed") {
    return "התשלום לא הושלם";
  }
  if (read.order.paymentStatus === "cancelled") {
    return "ההזמנה בוטלה";
  }
  return "ממתינים לתשלום";
}

export default function ThankYouView() {
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const [eventName, setEventName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [heroGift, setHeroGift] = useState("");
  const [contributions, setContributions] = useState<GuestContribution[]>([]);
  const [contributionAmount, setContributionAmount] = useState(0);
  const [feeAmount, setFeeAmount] = useState(0);
  const [chargedAmount, setChargedAmount] = useState(0);
  const [orderRead, setOrderRead] = useState<OrderRead>({ phase: "loading" });
  const [coverImage, setCoverImage] = useState("");
  const [giftImage, setGiftImage] = useState("");
  const [together, setTogether] = useState("");
  const [shareNote, setShareNote] = useState("");
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
      setGuestName(loadGuestDetails(slug).name);

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
        setCoverImage(stored.coverImage || "");
        setGiftImage(pictured?.imageUrl || "");
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
  const demoPaid = paid && order?.paymentProvider === "demo";
  const showReceiptAmounts = orderRead.phase === "ready";
  const giftLabel = contributions[0]?.giftName || heroGift || eventName || "המתנה";
  const shareText = eventName ? `בואו לחגוג: ${eventName}` : "בואו לחגוג ב-LOLO";
  const letter = (eventName || giftLabel).trim().charAt(0) || "";

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
    <div className={styles.thanksLayout}>
      <div className={styles.thanksHero}>
        <div className={styles.thanksCelebrant}>
          {coverImage ? (
            <img src={coverImage} alt="" width={160} height={200} />
          ) : (
            <EmptyCover monogram={letter} compact />
          )}
          <div>
            <p className={styles.thanksKicker}>חוגגים יחד</p>
            <p className={styles.thanksName}>{eventName || "המתנה המשותפת"}</p>
          </div>
        </div>
        <GiftReveal
          label={giftLabel}
          caption={guestName ? `מאת ${guestName}` : undefined}
          image={giftImage}
          cover=""
          funding={together}
          untie={Boolean(paid)}
        />
      </div>
      <div className={styles.thanksMain}>
        <div className={`${styles.card} ${styles.thanksReceipt}`}>
          <p className={styles.notice}>תשלום הדגמה — לא מתבצע חיוב אמיתי</p>
          <p className={styles.quietLine}>{BETA_CLARITY}</p>
          <p className={styles.orderStatus} data-order-status="" role="status">
            {statusText(orderRead)}
          </p>
          {demoPaid ? <p className={styles.quietLine}>תשלום הדגמה</p> : null}
          {showReceiptAmounts ? (
            <>
              {contributions.map((item) => (
                <p key={item.giftId} className={styles.lineRow}>
                  <span>{item.giftName}</span>
                  <b>{formatGiftAmount(item.amount)}</b>
                </p>
              ))}
              <p className={styles.lineRow}>
                <span>השתתפות במתנה</span>
                <b>{formatGiftAmount(contributionAmount)}</b>
              </p>
              <p className={styles.lineRow}>
                <span>{feeAmount > 0 ? "עמלת שירות" : "ללא עמלת שירות"}</span>
                {feeAmount > 0 ? <b>{formatGiftAmount(feeAmount)}</b> : null}
              </p>
              <p className={styles.totalLine}>
                <span>{paid ? "סכום בהדגמה" : "סה״כ"}</span>
                <span>{formatGiftAmount(chargedAmount)}</span>
              </p>
              {order?.paymentReference ? (
                <p className={styles.quietLine} dir="ltr">
                  {order.paymentReference}
                </p>
              ) : null}
            </>
          ) : null}
          {paid ? (
            <p className={styles.quietLine}>ההשתתפות נוספה למתנה. תודה שחגגתם יחד.</p>
          ) : null}
          {failed ? (
            <p className={styles.quietLine}>אפשר לחזור ולנסות שוב. לא בוצע חיוב.</p>
          ) : null}
          {orderRead.phase === "error" ? (
            <p className={styles.quietLine}>אפשר לרענן ולנסות לקרוא את הסטטוס שוב.</p>
          ) : null}
        </div>
        <div className={styles.shareRow}>
          <button
            type="button"
            className={failed ? styles.ghost : styles.cta}
            onClick={() => void shareEvent()}
          >
            שיתוף האירוע
          </button>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => {
              window.open(
                `https://wa.me/?text=${encodeURIComponent(`${shareText} ${eventUrl()}`)}`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            וואטסאפ
          </button>
          <button type="button" className={styles.ghost} onClick={() => void copyLink()}>
            העתקת קישור
          </button>
        </div>
        {shareNote === "copied" ? (
          <p className={styles.quietLine} role="status">
            הקישור הועתק
          </p>
        ) : null}
        {failed ? (
          <Link href={guestEventPath(slug, "payment")} className={styles.cta}>
            חזרה לתשלום
          </Link>
        ) : (
          <Link href={guestEventPath(slug)} className={styles.ghost}>
            חזרה לאירוע
          </Link>
        )}
      </div>
    </div>
  );
}
