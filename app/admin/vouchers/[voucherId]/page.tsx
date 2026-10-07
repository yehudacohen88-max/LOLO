import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import VoucherCard from "@/components/voucher-card";
import { getAdminSession } from "@/lib/admin/session";
import { appPublicOrigin, originFromProxyHeaders } from "@/lib/app-url";
import { formatGiftAmount } from "@/lib/guest-draft";
import {
  formatVoucherWhen,
  redemptionChannelLabel,
  settlementStatusLabel,
} from "@/lib/vouchers/labels";
import { getAdminVoucherDetail, listVoucherAdminRedemptions } from "@/lib/vouchers/repository";
import CancelVoucherButton from "./cancel-voucher-button";
import AdminRedeemForm from "./admin-redeem-form";

export const metadata: Metadata = {
  title: "פרטי שובר | LOLO",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ voucherId: string }>;
};

export default async function AdminVoucherPage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  const { voucherId } = await params;
  const headerStore = await headers();
  const origin = appPublicOrigin(originFromProxyHeaders(headerStore));
  let detail = null;
  let redemptions: Awaited<ReturnType<typeof listVoucherAdminRedemptions>> = [];
  let loadError = "";
  try {
    detail = await getAdminVoucherDetail(voucherId, origin);
    if (detail) {
      redemptions = await listVoucherAdminRedemptions(voucherId);
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת השובר נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8">
      <Link href="/admin/vouchers" className="text-sm font-semibold text-brand">
        חזרה לשוברים
      </Link>
      <h1 className="text-2xl font-bold sm:text-4xl">פרטי שובר</h1>
      {loadError ? <p className="text-sm text-brand">{loadError}</p> : null}
      {!loadError && !detail ? <p className="text-muted">השובר לא נמצא.</p> : null}
      {detail ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <VoucherCard model={detail.card} />
          <div className="flex flex-col gap-4">
            <AdminRedeemForm
              voucherId={detail.card.id}
              canRedeem={detail.canRedeem}
              allowPartial={detail.card.terms.allowPartialRedemption}
              remainingAmount={detail.card.remainingAmount}
            />
            {detail.canCancel ? <CancelVoucherButton voucherId={detail.card.id} /> : null}
            <section className="rounded-3xl border border-border bg-white p-5">
              <h2 className="text-lg font-bold">מימושים להתחשבנות</h2>
              <p className="mt-2 text-sm text-muted">
                העמלה ותנאי התשלום נשמרים כפי שהיו בבית העסק בזמן המימוש. הסיכום מולם יגיע בשלב הבא.
              </p>
              {redemptions.length === 0 ? (
                <p className="mt-4 text-sm text-muted">עדיין אין מימושים.</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {redemptions.map((redemption) => (
                    <li key={redemption.id} className="rounded-2xl border border-border px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{formatGiftAmount(redemption.amount)}</span>
                        <span>{settlementStatusLabel(redemption.settlementStatus)}</span>
                      </div>
                      <p className="mt-1 text-muted">
                        {formatVoucherWhen(redemption.redeemedAt)} · {redemptionChannelLabel(redemption.channel)}
                      </p>
                      <p className="mt-1 text-muted">
                        עמלה בהגדרה:{" "}
                        {redemption.commissionPercent == null
                          ? "לא הוגדר"
                          : `${redemption.commissionPercent.toLocaleString("he-IL")}%`}
                        {" · "}
                        תנאי תשלום:{" "}
                        {redemption.paymentTermsDays == null
                          ? "לא הוגדר"
                          : `${redemption.paymentTermsDays.toLocaleString("he-IL")} יום`}
                      </p>
                      {redemption.reference ? (
                        <p className="mt-1 text-muted">אסמכתה: {redemption.reference}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </main>
  );
}
