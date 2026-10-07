import Link from "next/link";
import FundingProgress from "@/components/funding-progress";
import GiftMedia from "@/components/gift-media";
import type {
  HostDashboardData,
  HostPaymentStatus,
} from "@/lib/host/dashboard";
import CopyGuestLink from "./copy-guest-link";
import HostGuestList from "./host-guest-list";

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
};

export default function HostDashboard({
  data,
  guestUrl,
  origin,
}: HostDashboardProps) {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 py-10 sm:max-w-3xl sm:px-8 sm:py-16">
        <header className="flex flex-col items-center text-center">
          <Link
            href="/"
            className="text-4xl font-extrabold tracking-[0.28em] text-brand sm:text-5xl"
          >
            LOLO
          </Link>
          <h1 className="mt-8 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            ניהול האירוע
          </h1>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {data.title || "האירוע"}
          </p>
        </header>

        <section className="rounded-3xl border border-border bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-foreground">סקירת האירוע</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">שם האירוע</dt>
              <dd className="mt-1 font-semibold">{data.title || "—"}</dd>
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
              <dd className="mt-1 font-semibold">{data.hostName || "—"}</dd>
            </div>
          </dl>
          <div className="mt-5">
            <p className="mb-2 text-sm text-muted">קישור האורחים</p>
            <CopyGuestLink guestUrl={guestUrl} />
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-foreground">סקירה כספית</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            הסכום ששולם הוא השתתפות שאושרה למתנות. עמלת שירות אינה נספרת ליעד.
            הזמנות שממתינות לתשלום עדיין לא נספרות, ואין עדיין משיכה לבית העסק.
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

        <section className="rounded-3xl border border-border bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-foreground">התקדמות המתנות</h2>
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
                          <p className="font-semibold text-foreground">
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
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <HostGuestList
          eventId={data.eventId}
          eventTitle={data.title}
          origin={origin}
          guests={data.invitedGuests}
        />

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
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
