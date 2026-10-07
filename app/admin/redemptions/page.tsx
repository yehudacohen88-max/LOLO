import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { listAdminStores } from "@/lib/admin/stores";
import { formatGiftAmount } from "@/lib/guest-draft";
import {
  formatVoucherWhen,
  redemptionChannelLabel,
  settlementStatusLabel,
} from "@/lib/vouchers/labels";
import { isUuid } from "@/lib/vouchers/input";
import { listAdminRedemptions } from "@/lib/vouchers/repository";

export const metadata: Metadata = {
  title: "מימושים | LOLO",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ store?: string }>;
};

export default async function AdminRedemptionsPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  const params = await searchParams;
  const storeId = params.store && isUuid(params.store) ? params.store : "";
  let redemptions: Awaited<ReturnType<typeof listAdminRedemptions>> = [];
  let stores: Awaited<ReturnType<typeof listAdminStores>> = [];
  let loadError = "";
  try {
    [redemptions, stores] = await Promise.all([
      listAdminRedemptions(storeId || undefined),
      listAdminStores(),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת המימושים נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-4xl">מימושים</h1>
        <p className="mt-2 text-base text-muted">
          כל מימוש שנקלט בחנות או דרך הניהול. זה הבסיס להתחשבנות מול בית העסק.
        </p>
      </header>
      <form className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
        <label className="flex flex-1 flex-col gap-2 text-sm font-semibold">
          בית עסק
          <select
            name="store"
            defaultValue={storeId}
            className="h-12 rounded-2xl border border-border bg-white px-4 font-normal"
          >
            <option value="">הכול</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
        >
          סינון
        </button>
      </form>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {!loadError && redemptions.length === 0 ? (
        <p className="mt-8 text-base text-muted">אין מימושים להצגה.</p>
      ) : null}
      <ul className="mt-6 flex flex-col gap-3">
        {redemptions.map((redemption) => (
          <li key={redemption.id} className="rounded-3xl border border-border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">{redemption.storeName || "בית עסק"}</p>
                <p className="mt-1 text-sm text-muted">{redemption.giftTitle || "מתנה"}</p>
              </div>
              <p className="text-xl font-bold">{formatGiftAmount(redemption.amount)}</p>
            </div>
            <p className="mt-3 text-sm text-muted">
              {formatVoucherWhen(redemption.redeemedAt)} · {redemptionChannelLabel(redemption.channel)} ·{" "}
              {settlementStatusLabel(redemption.settlementStatus)}
            </p>
            <p className="mt-1 font-mono text-sm" dir="ltr">
              {redemption.voucherCode}
            </p>
            <p className="mt-2 text-sm text-muted">
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
            <Link
              href={`/admin/vouchers/${redemption.voucherId}`}
              className="mt-3 inline-flex text-sm font-semibold text-brand"
            >
              לשובר
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
