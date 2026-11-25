"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/app/design/bold-host.module.css";
import { userFacingMessage } from "@/app/design/user-error";
import { voucherStatusLabel } from "@/lib/vouchers/labels";
import type { VoucherStatus } from "@/lib/vouchers/status";
import type { EventVoucherBalance } from "@/lib/vouchers/types";

const STATUSES = new Set<VoucherStatus>([
  "ISSUED",
  "PARTIALLY_REDEEMED",
  "REDEEMED",
  "EXPIRED",
  "CANCELLED",
  "SETTLEMENT_PENDING",
  "SETTLED",
]);

function money(amount: number) {
  return `${amount.toLocaleString("he-IL")} ₪`;
}

function statusLabel(status: string) {
  return STATUSES.has(status as VoucherStatus)
    ? voucherStatusLabel(status as VoucherStatus)
    : status;
}

export default function HostVoucherBalances({ eventId }: { eventId: string }) {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [vouchers, setVouchers] = useState<EventVoucherBalance[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/host/events/${eventId}/vouchers`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; vouchers?: EventVoucherBalance[] };
        if (!response.ok) {
          throw new Error(payload.error || "לא ניתן לטעון את יתרות השוברים.");
        }
        if (!cancelled) {
          setVouchers(payload.vouchers ?? []);
          setPhase("ready");
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(userFacingMessage(nextError, "לא ניתן לטעון את יתרות השוברים."));
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <section className={styles.card} id="host-balances" data-host-shot="balances">
      <h2>שוברים ויתרות</h2>
      <p className={styles.help}>היתרה נטענת מהשרת. שובר הדגמה אינו כסף שהתקבל.</p>
      {phase === "loading" ? <p className={styles.help}>טוענים יתרות...</p> : null}
      {phase === "error" ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {phase === "ready" && vouchers.length === 0 ? (
        <div className={styles.empty}>
          <p>עדיין אין שוברים לאירוע.</p>
        </div>
      ) : null}
      {phase === "ready" && vouchers.length > 0 ? (
        <ul className={styles.stack}>
          {vouchers.map((voucher) => (
            <li key={voucher.voucherId} className={styles.order}>
              <div className={styles.orderTop}>
                <p className={styles.orderName}>{voucher.giftTitle}</p>
                <span className={styles.badge}>{statusLabel(voucher.status)}</span>
              </div>
              <p className={styles.help}>{voucher.storeName}</p>
              <p className={styles.amount}>יתרה {money(voucher.remainingAmount)}</p>
              <p className={styles.help}>מתוך {money(voucher.amount)}</p>
              <Link href={`/host/events/${eventId}/vouchers/${voucher.voucherId}`} className={styles.secondary}>
                כרטיס השובר
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
