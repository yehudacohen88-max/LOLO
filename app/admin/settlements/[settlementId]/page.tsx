import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SettlementFigures from "@/components/settlement-figures";
import { settlementLabel } from "@/lib/admin/store-fields";
import { getAdminSession } from "@/lib/admin/session";
import { formatGiftAmount } from "@/lib/guest-draft";
import { lineCommissionLabel, lineTermsLabel, settlementBatchLabel } from "@/lib/settlements/labels";
import { getSettlement } from "@/lib/settlements/repository";
import { formatVoucherWhen } from "@/lib/vouchers/labels";
import { isUuid } from "@/lib/vouchers/input";
import CancelSettlementButton from "../cancel-settlement-button";
import MarkPaidPanel from "../mark-paid-panel";

export const metadata: Metadata = {
  title: "התחשבנות | LOLO",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ settlementId: string }>;
};

export default async function AdminSettlementDetailPage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  const { settlementId } = await params;
  if (!isUuid(settlementId)) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
        <p className="text-base text-muted">ההתחשבנות לא נמצאה.</p>
      </main>
    );
  }

  let settlement: Awaited<ReturnType<typeof getSettlement>> = null;
  let loadError = "";
  try {
    settlement = await getSettlement(settlementId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת ההתחשבנות נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8">
      <Link href="/admin/settlements" className="text-sm font-semibold text-brand">
        לכל ההתחשבנויות
      </Link>
      {loadError ? <p className="text-sm text-brand">{loadError}</p> : null}
      {!loadError && !settlement ? (
        <p className="text-base text-muted">ההתחשבנות לא נמצאה.</p>
      ) : null}
      {settlement ? (
        <>
          <header>
            <p className="text-sm text-muted">{settlement.storeName}</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-4xl">התחשבנות</h1>
            <p className="mt-3 text-base text-muted">
              {settlement.overdue ? "באיחור · " : ""}
              {settlementBatchLabel(settlement.status)} · יעד {formatVoucherWhen(settlement.dueAt)}
            </p>
          </header>

          <section
            className={`rounded-3xl border p-5 ${
              settlement.overdue ? "border-amber-300 bg-amber-50" : "border-border bg-white"
            }`}
          >
            <SettlementFigures
              gross={settlement.grossAmount}
              commission={settlement.commissionAmount}
              payable={settlement.payableAmount}
            />
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">תאריך יעד</dt>
                <dd className="mt-1 font-semibold">{formatVoucherWhen(settlement.dueAt)}</dd>
              </div>
              <div>
                <dt className="text-muted">סטטוס</dt>
                <dd className="mt-1 font-semibold">
                  {settlement.overdue ? "באיחור" : settlementBatchLabel(settlement.status)}
                </dd>
              </div>
            </dl>
          </section>

          <aside className="rounded-3xl border border-border bg-brand-soft px-5 py-4 text-sm leading-relaxed">
            <p className="font-semibold">דמי שירות מאורחים</p>
            <p className="mt-1 text-muted">
              דמי השירות שנגבו מהאורחים שייכים להזמנות ולאירועים, לא להתחשבנות מול בית העסק. הם
              נספרים יחד עם עמלות בתי העסק בהכנסות LOLO בלוח הבקרה. חלק LOLO מההתחשבנות הזו הוא
              העמלה בלבד: {formatGiftAmount(settlement.commissionAmount)}.
            </p>
            <Link href="/admin" className="mt-3 inline-flex font-semibold text-brand">
              להכנסות LOLO
            </Link>
          </aside>

          {settlement.status === "PAID" ? (
            <section className="rounded-3xl border border-border bg-white p-5">
              <h2 className="text-lg font-bold">תשלום שתועד</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                סומן כשולם {settlement.paidAt ? formatVoucherWhen(settlement.paidAt) : ""}. אופן
                התשלום: {settlementLabel(settlement.paymentMethod)}.
                {settlement.paymentReference ? ` אסמכתה: ${settlement.paymentReference}.` : ""} בגרסת
                ההדגמה זו אינה העברה בנקאית.
              </p>
            </section>
          ) : null}

          {settlement.status === "CANCELLED" ? (
            <section className="rounded-3xl border border-border bg-white p-5">
              <h2 className="text-lg font-bold">ההתחשבנות בוטלה</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                הסכומים נשמרו לתיעוד. המימושים חזרו למצב שטרם הוסדר ואפשר לכלול אותם בהתחשבנות חדשה.
              </p>
            </section>
          ) : null}

          <section>
            <h2 className="text-xl font-bold">מימושים בהתחשבנות</h2>
            {settlement.lines.length === 0 ? (
              <p className="mt-4 text-base text-muted">אין שורות להצגה.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {settlement.lines.map((line) => (
                  <li key={line.id} className="rounded-3xl border border-border bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{line.giftTitle}</p>
                        <p className="mt-1 text-sm text-muted">{line.eventTitle}</p>
                        <p className="mt-1 font-mono text-sm" dir="ltr">
                          {line.voucherCode}
                        </p>
                      </div>
                      <p className="text-lg font-bold">{formatGiftAmount(line.payableAmount)}</p>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-muted">סכום שמומש</dt>
                        <dd className="mt-1 font-semibold">{formatGiftAmount(line.grossAmount)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">עמלה</dt>
                        <dd className="mt-1 font-semibold">
                          {lineCommissionLabel(line.commissionPercent, line.commissionSpecified)} ·{" "}
                          {formatGiftAmount(line.commissionAmount)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">תנאי תשלום</dt>
                        <dd className="mt-1 font-semibold">
                          {lineTermsLabel(line.paymentTermsDays, line.termsSpecified)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">מועד מימוש</dt>
                        <dd className="mt-1 font-semibold">{formatVoucherWhen(line.redeemedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">יעד לשורה</dt>
                        <dd className="mt-1 font-semibold">{formatVoucherWhen(line.dueAt)}</dd>
                      </div>
                    </dl>
                    <Link
                      href={`/admin/vouchers/${line.voucherId}`}
                      className="mt-3 inline-flex text-sm font-semibold text-brand"
                    >
                      לשובר
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {settlement.status === "PENDING" ? (
            <>
              <MarkPaidPanel
                settlementId={settlement.id}
                payableLabel={formatGiftAmount(settlement.payableAmount)}
                defaultMethod={settlement.settlementMethod ?? "manual"}
              />
              <CancelSettlementButton settlementId={settlement.id} />
            </>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
