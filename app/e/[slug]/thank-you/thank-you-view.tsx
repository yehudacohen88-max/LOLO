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
  saveContributions,
  type GuestContribution,
} from "@/lib/guest-draft";
import { loadPendingGuestOrder } from "@/lib/orders/client";
import { clearGuestOrderRef } from "@/lib/orders/guest-ref";
import { thankYouAfterLoad } from "@/lib/orders/thank-you-ref";
import type { PaymentStatus } from "@/lib/orders/types";
import { GiftReveal } from "../flagship-ui";
import { giftProgressCopy, participationLine } from "../progress-copy";
import styles from "../flagship.module.css";

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
  const [settled, setSettled] = useState(false);
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
      const localTotal = getContributionsTotal(local);
      setGuestName(loadGuestDetails(slug).name);
      setContributions(local);
      setContributionAmount(localTotal);
      setChargedAmount(localTotal);

      const [stored, order] = await Promise.all([
        getEventBySlug(slug),
        loadPendingGuestOrder(slug),
      ]);
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
        saveContributions(slug, []);
      }

      const gifts = [...(stored?.gifts ?? [])].filter((item) => item.active !== false);
      const chosenId = (order?.items?.[0]?.giftId || local[0]?.giftId) ?? "";
      const pictured =
        gifts.find((item) => item.id === chosenId) ??
        gifts.sort((a, b) => a.priority - b.priority)[0];
      if (!cancelled && stored) {
        setEventName((current) => current || stored.title);
        setCoverImage(stored.coverImage || "");
        setGiftImage(pictured?.imageUrl || "");
      }
      if (!cancelled) {
        setSettled(true);
      }

      const gift = [...(stored?.gifts ?? [])]
        .filter((item) => item.active !== false)
        .sort((a, b) => a.priority - b.priority)[0];
      if (gift) {
        try {
          const response = await fetch(
            `/api/events/${encodeURIComponent(slug)}/funding`,
            { cache: "no-store" },
          );
          if (response.ok) {
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
          }
        } catch {
          if (!cancelled) {
            setTogether("");
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const paid = paymentStatus === "paid";
  const failed = paymentStatus === "failed";
  const demoPaid = paid && paymentProvider === "demo";
  const known = settled || contributions.length > 0;
  const giftLabel = contributions[0]?.giftName || eventName || "המתנה";
  const shareText = eventName ? `בואו לחגוג: ${eventName}` : "בואו לחגוג ב-LOLO";

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
        <GiftReveal
          label={giftLabel}
          caption={eventName}
          image={giftImage}
          cover={coverImage}
          funding={together}
          untie={paid}
        />
      </div>
      <div className={styles.thanksMain}>
        <div className={styles.card}>
          <p className={styles.notice}>גרסת בטא — תשלומים מדומים בלבד</p>
          {!settled && !known ? (
            <div className={styles.bones} aria-busy="true" aria-label="טוענים את פרטי המתנה">
              <span />
              <span />
              <span />
            </div>
          ) : !settled ? (
            <p className={styles.quietLine}>מאשרים את התשלום...</p>
          ) : paid ? (
            <p className={styles.lineRow}>התשלום התקבל</p>
          ) : failed ? (
            <p className={styles.lineRow}>התשלום לא הושלם</p>
          ) : (
            <p className={styles.lineRow}>ממתינים לתשלום</p>
          )}
          {demoPaid ? <p className={styles.quietLine}>תשלום הדגמה</p> : null}
          {demoPaid ? (
            <p className={styles.notice}>תשלום הדגמה — לא מתבצע חיוב אמיתי</p>
          ) : null}
          {known && eventName ? <p className={styles.lineRow}>{eventName}</p> : null}
          {known && guestName ? <p className={styles.quietLine}>מאת {guestName}</p> : null}
          {contributions.map((item) => (
            <p key={item.giftId} className={styles.lineRow}>
              <span>{item.giftName}</span>
              <b>{formatGiftAmount(item.amount)}</b>
            </p>
          ))}
          {known ? (
            <>
              <p className={styles.lineRow}>
                <span>השתתפות במתנה</span>
                <b>{formatGiftAmount(contributionAmount)}</b>
              </p>
              <p className={styles.lineRow}>
                <span>{feeAmount > 0 ? "עמלת שירות" : "ללא עמלת שירות"}</span>
                {feeAmount > 0 ? <b>{formatGiftAmount(feeAmount)}</b> : null}
              </p>
              <p className={styles.totalLine}>
                <span>{paid ? "שולם" : "סה״כ"}</span>
                <span>{formatGiftAmount(chargedAmount)}</span>
              </p>
            </>
          ) : null}
          {demoPaid && paymentReference ? (
            <p className={styles.quietLine} dir="ltr">
              {paymentReference}
            </p>
          ) : null}
          {settled ? (
            <p className={styles.quietLine}>
              {paid
                ? "ההשתתפות נוספה למתנה. תודה שחגגתם יחד."
                : failed
                  ? "אפשר לחזור ולנסות שוב. לא בוצע חיוב."
                  : "ההזמנה נשמרה. התשלום עדיין לא בוצע."}
            </p>
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
