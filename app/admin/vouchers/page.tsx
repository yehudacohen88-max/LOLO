import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { listAdminStores } from "@/lib/admin/stores";
import { formatGiftAmount } from "@/lib/guest-draft";
import { formatVoucherWhen, voucherStatusLabel } from "@/lib/vouchers/labels";
import { VOUCHER_STATUSES } from "@/lib/vouchers/status";
import { isUuid } from "@/lib/vouchers/input";
import { listAdminVouchers } from "@/lib/vouchers/repository";

export const metadata: Metadata = {
  title: "שוברים | LOLO",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ status?: string; store?: string }>;
};

export default async function AdminVouchersPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  const params = await searchParams;
  const status = VOUCHER_STATUSES.find((item) => item === params.status) ?? "";
  const storeId = params.store && isUuid(params.store) ? params.store : "";

  let vouchers: Awaited<ReturnType<typeof listAdminVouchers>> = [];
  let stores: Awaited<ReturnType<typeof listAdminStores>> = [];
  let loadError = "";
  try {
    [vouchers, stores] = await Promise.all([
      listAdminVouchers({ status: status || undefined, storeId: storeId || undefined }),
      listAdminStores(),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת השוברים נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-4xl">שוברים</h1>
        <p className="mt-2 text-base text-muted">
          שוברים שהונפקו לבעלי אירועים. ההתחשבנות מול בתי העסק תגיע בשלב הבא.
        </p>
      </header>

      <form className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" method="get">
        <label className="flex flex-col gap-2 text-sm font-semibold">
          סטטוס
          <select
            name="status"
            defaultValue={status}
            className="h-12 rounded-2xl border border-border bg-white px-4 font-normal"
          >
            <option value="">הכול</option>
            {VOUCHER_STATUSES.map((item) => (
              <option key={item} value={item}>
                {voucherStatusLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">
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
          className="inline-flex h-12 items-center justify-center self-end rounded-full bg-brand px-6 font-semibold text-white"
        >
          סינון
        </button>
      </form>

      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {!loadError && vouchers.length === 0 ? (
        <p className="mt-8 text-base text-muted">אין שוברים להצגה.</p>
      ) : null}

      <ul className="mt-6 flex flex-col gap-3">
        {vouchers.map((voucher) => (
          <li key={voucher.id} className="rounded-3xl border border-border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-foreground">{voucher.giftTitle || "מתנה"}</p>
                <p className="mt-1 text-sm text-muted">
                  {voucher.storeName} · {voucher.eventTitle}
                </p>
              </div>
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                {voucherStatusLabel(voucher.status)}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold">{formatGiftAmount(voucher.amount)}</p>
            <p className="mt-1 text-sm text-muted">
              יתרה {formatGiftAmount(voucher.remainingAmount)} · עד {formatVoucherWhen(voucher.expiresAt)}
            </p>
            <p className="mt-2 font-mono text-sm tracking-wide" dir="ltr">
              {voucher.code}
            </p>
            <Link
              href={`/admin/vouchers/${voucher.id}`}
              className="mt-4 inline-flex text-sm font-semibold text-brand"
            >
              פרטי השובר
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
