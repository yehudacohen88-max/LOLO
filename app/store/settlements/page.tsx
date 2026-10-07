import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SettlementFigures from "@/components/settlement-figures";
import { settlementLabel } from "@/lib/admin/store-fields";
import { formatGiftAmount } from "@/lib/guest-draft";
import { settlementBatchLabel } from "@/lib/settlements/labels";
import { listStoreSettlementDetails } from "@/lib/settlements/repository";
import type { SettlementDetail } from "@/lib/settlements/types";
import { getStoreSession } from "@/lib/store/session";
import { formatVoucherWhen } from "@/lib/vouchers/labels";
import { getStoreLabel } from "@/lib/vouchers/repository";
import StoreLogoutButton from "../redeem/logout-button";

export const metadata: Metadata = {
  title: "התחשבנויות | LOLO",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StoreSettlementsPage() {
  const session = await getStoreSession();
  if (!session) {
    redirect("/store");
  }

  let storeName = "";
  let settlements: SettlementDetail[] = [];
  let loadError = "";
  try {
    storeName = await getStoreLabel(session.storeId);
  } catch (error) {
    console.error("[LOLO] store settlements", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
  try {
    settlements = await listStoreSettlementDetails(session.storeId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת ההתחשבנויות נכשלה.";
  }

  const pending = settlements.filter((item) => item.status === "PENDING");
  const paid = settlements.filter((item) => item.status === "PAID");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-2xl font-extrabold tracking-[0.22em] text-brand">
            LOLO
          </Link>
          <h1 className="mt-4 text-2xl font-bold">התחשבנויות</h1>
          <p className="mt-1 text-sm text-muted">{storeName || "בית העסק"}</p>
        </div>
        <StoreLogoutButton />
      </header>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        כאן רואים התחשבנויות שממתינות לתשלום והתחשבנויות ששולמו. הסכום לתשלום הוא מה שמומש פחות עמלת
        LOLO.
      </p>
      <Link href="/store/redeem" className="mt-4 text-sm font-semibold text-brand">
        חזרה למימוש שוברים
      </Link>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {!loadError && settlements.length === 0 ? (
        <p className="mt-8 text-base text-muted">אין עדיין התחשבנויות להצגה.</p>
      ) : null}
      {pending.length > 0 ? <h2 className="mt-8 text-lg font-bold">ממתינות לתשלום</h2> : null}
      <SettlementList items={pending} />
      {paid.length > 0 ? <h2 className="mt-8 text-lg font-bold">שולמו</h2> : null}
      <SettlementList items={paid} />
    </main>
  );
}

function SettlementList({ items }: { items: SettlementDetail[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <ul className="mt-3 flex flex-col gap-3">
      {items.map((settlement) => (
        <li
          key={settlement.id}
          className={`rounded-3xl border p-5 ${
            settlement.overdue ? "border-amber-300 bg-amber-50" : "border-border bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold">
              {settlement.overdue ? "באיחור" : settlementBatchLabel(settlement.status)}
            </p>
            <p className="text-sm text-muted">יעד {formatVoucherWhen(settlement.dueAt)}</p>
          </div>
          <div className="mt-4">
            <SettlementFigures
              gross={settlement.grossAmount}
              commission={settlement.commissionAmount}
              payable={settlement.payableAmount}
            />
          </div>
          {settlement.status === "PAID" && settlement.paidAt ? (
            <p className="mt-3 text-sm text-muted">
              שולם {formatVoucherWhen(settlement.paidAt)}
              {settlement.paymentMethod ? ` · ${settlementLabel(settlement.paymentMethod)}` : ""}
              {settlement.paymentReference ? ` · ${settlement.paymentReference}` : ""}
            </p>
          ) : null}
          {settlement.lines.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {settlement.lines.map((line) => (
                <li key={line.id} className="flex items-start justify-between gap-3">
                  <span>
                    {line.giftTitle}
                    <span className="mt-1 block font-mono text-xs text-muted" dir="ltr">
                      {line.voucherCode}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold">{formatGiftAmount(line.payableAmount)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
