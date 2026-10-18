import Link from "next/link";
import LoloMark from "@/app/design/lolo-mark";
import styles from "@/app/design/host-experience.module.css";
import FundingProgress from "@/components/funding-progress";
import GiftMedia from "@/components/gift-media";
import GiftTimeline from "@/components/gift-timeline";
import type {
  HostDashboardData,
  HostDashboardGift,
  HostPaymentStatus,
} from "@/lib/host/dashboard";
import CopyGuestLink from "./copy-guest-link";
import HostGuestList from "./host-guest-list";
import IssueVoucherPanel from "./issue-voucher-panel";

function formatMoney(amount: number) {
  return `${amount.toLocaleString("he-IL")} ₪`;
}

function formatEventDate(date: string) {
  if (!date) {
    return "לא צוין תאריך";
  }

  const parsed = new Date(`${date}T00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatOrderDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentLabel(status: HostPaymentStatus) {
  if (status === "paid") {
    return "שולם";
  }
  if (status === "failed") {
    return "התשלום נכשל";
  }
  if (status === "cancelled") {
    return "בוטל";
  }
  return "ממתין לתשלום";
}

function redemptionStage(vouchers: HostDashboardGift["vouchers"]) {
  const active = vouchers.filter(
    (voucher) => voucher.status !== "CANCELLED" && voucher.status !== "EXPIRED",
  );
  const touched = active.filter((voucher) => voucher.remainingAmount < voucher.amount);
  if (touched.length === 0) {
    return "none" as const;
  }
  const fully =
    active.length > 0 && active.every((voucher) => voucher.remainingAmount === 0);
  return fully ? ("full" as const) : ("partial" as const);
}

function paymentClass(status: HostPaymentStatus) {
  if (status === "paid") {
    return "bg-brand-soft text-brand";
  }
  if (status === "failed" || status === "cancelled") {
    return "bg-border text-muted";
  }
  return "bg-brand-soft/60 text-foreground";
}

type HostDashboardProps = {
  data: HostDashboardData;
  guestUrl: string;
  origin: string;
  exampleNote?: string;
};

export default function HostDashboard({
  data,
  guestUrl,
  origin,
  exampleNote,
}: HostDashboardProps) {
  const readOnly = Boolean(exampleNote);
  return (
    <main className={styles.board}>
        <header className={styles.boardHead}>
          <Link href="/" className={styles.wordmark}>
            <LoloMark />
          </Link>
          <h1 className={styles.title}>ניהול האירוע</h1>
          <p className="mt-3 text-lg font-semibold text-foreground" dir="auto">
            {data.title || "האירוע"}
          </p>
          {exampleNote ? (
            <>
              <p className={styles.example} role="note">
                {exampleNote}
              </p>
              <p className={styles.exampleHint}>בדוגמה זו הפעולות מושבתות</p>
            </>
          ) : null}
        </header>

        <div className={styles.columns}>
        <div className={styles.stack}>
        <section className="rounded-3xl border border-border bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-foreground">סקירת האירוע</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">שם האירוע</dt>
              <dd className="mt-1 font-semibold" dir="auto">
                {data.title || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">סוג האירוע</dt>
              <dd className="mt-1 font-semibold">{data.eventType || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">תאריך</dt>
              <dd className="mt-1 font-semibold">{formatEventDate(data.eventDate)}</dd>
            </div>
            <div>
              <dt className="text-muted">שם המארח</dt>
              <dd className="mt-1 font-semibold" dir="auto">
                {data.hostName || "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-5">
            <p className="mb-2 text-sm text-muted">קישור האורחים</p>
            <CopyGuestLink guestUrl={guestUrl} disabled={readOnly} />
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-foreground">סקירה כספית</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            הסכום ששולם הוא השתתפות שאושרה למתנות. עמלת שירות אינה נספרת ליעד.
            אפשר להנפיק שובר על הסכום ששולם גם לפני שהיעד הושלם, ותשלום שמגיע אחר כך נשאר פנוי לשובר נוסף.
            מימוש בחנות אינו התחשבנות מול LOLO.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl bg-brand-soft px-4 py-4">
              <p className="text-sm text-muted">סכום ששולם בהצלחה</p>
              <p className="mt-1 text-2xl font-bold text-brand">
                {formatMoney(data.paidAmount)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {data.paidOrderCount === 0
                  ? "אין הזמנות ששולמו עדיין"
                  : `${data.paidOrderCount} הזמנות ששולמו`}
              </p>
            </article>
            <article className="rounded-2xl border border-border px-4 py-4">
              <p className="text-sm text-muted">סכום ממתין לתשלום</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatMoney(data.pendingAmount)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {data.pendingOrderCount === 0
                  ? "אין הזמנות ממתינות"
                  : `${data.pendingOrderCount} הזמנות ממתינות`}
              </p>
            </article>
          </div>
        </section>

        <HostGuestList
          eventId={data.eventId}
          eventTitle={data.title}
          origin={origin}
          guests={data.invitedGuests}
          disabled={readOnly}
        />
        </div>

        <div className={styles.stack}>
        <section className="rounded-3xl border border-border bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-foreground">התקדמות המתנות</h2>
          {data.vouchersReady ? null : (
            <p className="mt-3 text-sm text-muted">
              הנפקת שוברים עדיין לא זמינה.
            </p>
          )}
          {data.gifts.length === 0 ? (
            <p className="mt-4 text-sm text-muted">אין מתנות באירוע זה.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {data.gifts.map((gift) => {
                return (
                  <li
                    key={gift.id}
                    className="rounded-2xl border border-border px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <GiftMedia
                        imageUrl={gift.imageUrl}
                        icon={gift.icon}
                        alt=""
                        className="h-16 w-16 text-2xl"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-foreground" dir="auto">
                            {gift.title || "מתנה"}
                          </p>
                          {gift.targetAmount ? (
                            <p className="shrink-0 text-sm text-muted">
                              יעד {formatMoney(gift.targetAmount)}
                            </p>
                          ) : null}
                        </div>
                        {gift.description ? (
                          <p className="mt-1 text-sm leading-relaxed text-muted">
                            {gift.description}
                          </p>
                        ) : null}
                        {gift.storeName ? (
                          <p className="mt-1 text-sm text-muted">חנות: {gift.storeName}</p>
                        ) : null}
                      </div>
                    </div>
                    <FundingProgress
                      raisedAmount={gift.paidAmount}
                      pendingAmount={gift.pendingAmount}
                      percentOfTarget={gift.percentOfTarget}
                      contributorCount={gift.contributorCount}
                      showPending
                    />
                    <GiftTimeline
                      paid={gift.paidAmount > 0}
                      issued={gift.vouchers.some((voucher) => voucher.status !== "CANCELLED")}
                      redeemed={redemptionStage(gift.vouchers)}
                    />
                    {gift.vouchers.some(
                      (voucher) =>
                        voucher.status === "ISSUED" || voucher.status === "PARTIALLY_REDEEMED",
                    ) ? (
                      <p className="mt-2 text-sm font-semibold text-brand">
                        הצעד הבא: הציגו את הכרטיס בחנות
                      </p>
                    ) : null}
                    {data.vouchersReady ? (
                      <IssueVoucherPanel
                        eventId={data.eventId}
                        gift={gift}
                        stores={data.voucherStores}
                        disabled={readOnly}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-foreground">הזמנות אורחים</h2>
          {data.orders.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              אין הזמנות עדיין. כשאורחים יבחרו מתנות, ההזמנות יופיעו כאן.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {data.orders.map((order) => (
                <li
                  key={order.id}
                  className="rounded-2xl border border-border px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">
                      {order.guestName || "אורח"}
                    </p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentClass(order.paymentStatus)}`}
                    >
                      {paymentLabel(order.paymentStatus)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {formatOrderDate(order.createdAt)}
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {formatMoney(order.totalAmount)}
                  </p>
                  <p className="text-xs text-muted">השתתפות במתנה</p>
                  {order.guestPhone || order.guestEmail ? (
                    <div className="mt-2 space-y-1 text-sm text-muted" dir="ltr">
                      {order.guestPhone ? <p>{order.guestPhone}</p> : null}
                      {order.guestEmail ? <p>{order.guestEmail}</p> : null}
                    </div>
                  ) : null}
                  {order.greetingText ? (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                      {order.greetingText}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
        </div>
    </main>
  );
}
