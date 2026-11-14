import Link from "next/link";
import LoloMark from "@/app/design/lolo-mark";
import styles from "@/app/design/bold-host.module.css";
import FundingProgress from "@/components/funding-progress";
import GiftTimeline from "@/components/gift-timeline";
import HostPhotoEditor from "./host-photo-editor";
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

function paymentClass(status: HostPaymentStatus) {
  if (status === "paid") {
    return styles.paid;
  }
  if (status === "failed" || status === "cancelled") {
    return styles.failed;
  }
  return styles.pending;
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

type HostDashboardProps = {
  data: HostDashboardData;
  guestUrl: string;
  origin: string;
  exampleNote?: string;
  actionsEnabled?: boolean;
};

export default function HostDashboard({
  data,
  guestUrl,
  origin,
  exampleNote,
  actionsEnabled = false,
}: HostDashboardProps) {
  const sample = Boolean(exampleNote);
  const locked = sample && !actionsEnabled;

  return (
    <main className={styles.board} data-host-dashboard="">
      <div className={`${styles.mast} ${styles.wide}`} data-host-shot="top">
        <header>
          <Link href="/" className={styles.wordmark}>
            <LoloMark />
          </Link>
          <p className={styles.kicker}>ניהול האירוע</p>
          <h1 className={styles.eventTitle} dir="auto">
            {data.title || "האירוע"}
          </h1>
          <ul className={styles.meta}>
            <li>{formatEventDate(data.eventDate)}</li>
            <li>{data.eventType || "סוג לא צוין"}</li>
            <li dir="auto">{data.hostName || "מארח לא צוין"}</li>
          </ul>
          {exampleNote ? (
            <>
              <p className={styles.example} role="note">
                {exampleNote}
              </p>
              {locked ? <p className={styles.exampleHint}>בדוגמה זו הפעולות מושבתות</p> : null}
            </>
          ) : null}
          <nav className={styles.nav} aria-label="ניווט בניהול">
            <a href="#host-overview">סקירה</a>
            <a href="#host-finance">כספים</a>
            <a href="#host-gifts">מתנות</a>
            <a href="#host-orders">הזמנות</a>
            <a href="#host-guests">מוזמנים</a>
          </nav>
        </header>

        <section className={styles.card} id="host-overview" data-host-shot="overview">
          <h2>סקירת האירוע</h2>
          <div className={styles.overview}>
            <HostPhotoEditor
              eventId={data.eventId}
              initialUrl={data.coverImage}
              eventType={data.eventType}
              title={data.title || "האירוע"}
              previewOnly={sample}
            />
            <div>
              <dl className={styles.facts}>
                <div>
                  <dt>שם האירוע</dt>
                  <dd dir="auto">{data.title || "—"}</dd>
                </div>
                <div>
                  <dt>סוג האירוע</dt>
                  <dd>{data.eventType || "—"}</dd>
                </div>
                <div>
                  <dt>תאריך</dt>
                  <dd>{formatEventDate(data.eventDate)}</dd>
                </div>
                <div>
                  <dt>שם המארח</dt>
                  <dd dir="auto">{data.hostName || "—"}</dd>
                </div>
              </dl>
              <div>
                <p className={styles.help}>קישור האורחים</p>
                <CopyGuestLink guestUrl={guestUrl} disabled={locked} />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className={styles.layout}>
        <section className={styles.card} id="host-finance" data-host-shot="finance">
          <h2>סקירה כספית</h2>
          <p className={styles.help}>
            הסכום ששולם הוא השתתפות שאושרה למתנות. עמלת שירות אינה נספרת ליעד.
            אפשר להנפיק שובר על הסכום ששולם גם לפני שהיעד הושלם, ותשלום שמגיע אחר כך נשאר פנוי לשובר נוסף.
            מימוש בחנות אינו התחשבנות מול LOLO.
          </p>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <p>סכום ששולם בהצלחה</p>
              <strong>{formatMoney(data.paidAmount)}</strong>
              <p>
                {data.paidOrderCount === 0
                  ? "אין הזמנות ששולמו עדיין"
                  : `${data.paidOrderCount} הזמנות ששולמו`}
              </p>
            </div>
            <div className={`${styles.stat} ${styles.statPending}`}>
              <p>סכום ממתין לתשלום</p>
              <strong>{formatMoney(data.pendingAmount)}</strong>
              <p>
                {data.pendingOrderCount === 0
                  ? "אין הזמנות ממתינות"
                  : `${data.pendingOrderCount} הזמנות ממתינות`}
              </p>
            </div>
          </div>
        </section>

        <section className={styles.card} id="host-orders" data-host-shot="orders">
          <h2>הזמנות אורחים</h2>
          {data.orders.length === 0 ? (
            <div className={styles.empty}>
              <p>אין הזמנות עדיין. כשאורחים יבחרו מתנות, ההזמנות יופיעו כאן.</p>
            </div>
          ) : (
            <ul className={styles.stack}>
              {data.orders.map((order) => (
                <li key={order.id} className={styles.order}>
                  <div className={styles.orderTop}>
                    <p className={styles.orderName}>{order.guestName || "אורח"}</p>
                    <span className={`${styles.badge} ${paymentClass(order.paymentStatus)}`}>
                      {paymentLabel(order.paymentStatus)}
                    </span>
                  </div>
                  <p className={styles.help}>{formatOrderDate(order.createdAt)}</p>
                  <p className={styles.amount}>{formatMoney(order.totalAmount)}</p>
                  <p className={styles.help}>השתתפות במתנה</p>
                  {order.guestPhone || order.guestEmail ? (
                    <div className={styles.help} dir="ltr">
                      {order.guestPhone ? <p>{order.guestPhone}</p> : null}
                      {order.guestEmail ? <p>{order.guestEmail}</p> : null}
                    </div>
                  ) : null}
                  {order.greetingText ? (
                    <p className={styles.help}>{order.greetingText}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${styles.card} ${styles.wide}`} id="host-gifts" data-host-shot="gifts">
          <h2>התקדמות המתנות</h2>
          {data.vouchersReady ? null : (
            <p className={styles.help}>הנפקת שוברים עדיין לא זמינה.</p>
          )}
          {data.gifts.length === 0 ? (
            <div className={styles.empty}>
              <p>אין מתנות באירוע זה.</p>
            </div>
          ) : (
            <ul className={styles.stack}>
              {data.gifts.map((gift) => (
                <li key={gift.id} className={styles.gift} data-gift-target={gift.targetAmount == null ? "hidden" : "shown"}>
                  <HostPhotoEditor
                    eventId={data.eventId}
                    giftId={gift.id}
                    initialUrl={gift.imageUrl}
                    title={gift.title || "מתנה"}
                    description={gift.description}
                    previewOnly={sample}
                  />
                  <div className={styles.giftHead}>
                    <h3 className={styles.giftTitle} dir="auto">
                      {gift.title || "מתנה"}
                    </h3>
                    {gift.targetAmount ? (
                      <p className={styles.target}>יעד {formatMoney(gift.targetAmount)}</p>
                    ) : null}
                  </div>
                  {gift.targetAmount == null ? (
                    <p className={styles.hiddenAmount}>בלי יעד מוצג לאורחים</p>
                  ) : null}
                  {gift.description ? <p className={styles.help}>{gift.description}</p> : null}
                  {gift.storeName ? <p className={styles.help}>חנות: {gift.storeName}</p> : null}
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
                    <p className={styles.help}>הצעד הבא: הציגו את הכרטיס בחנות</p>
                  ) : null}
                  {data.vouchersReady ? (
                    <IssueVoucherPanel
                      eventId={data.eventId}
                      gift={gift}
                      stores={data.voucherStores}
                      disabled={locked}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className={styles.wide}>
          <HostGuestList
            eventId={data.eventId}
            eventTitle={data.title}
            origin={origin}
            guests={data.invitedGuests}
            disabled={locked}
          />
        </div>
      </div>
    </main>
  );
}
