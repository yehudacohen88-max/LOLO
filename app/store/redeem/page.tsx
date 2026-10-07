import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStoreSession } from "@/lib/store/session";
import { getStoreLabel } from "@/lib/vouchers/repository";
import RedeemForm from "./redeem-form";
import StoreLogoutButton from "./logout-button";

export const metadata: Metadata = {
  title: "מימוש שובר | LOLO",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StoreRedeemPage() {
  const session = await getStoreSession();
  if (!session) {
    redirect("/store");
  }

  let storeName = "";
  try {
    storeName = await getStoreLabel(session.storeId);
  } catch (error) {
    console.error("[LOLO] store redeem page", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-2xl font-extrabold tracking-[0.22em] text-brand">
            LOLO
          </Link>
          <h1 className="mt-4 text-2xl font-bold">מימוש שובר</h1>
          <p className="mt-1 text-sm text-muted">{storeName || "בית העסק"}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <StoreLogoutButton />
          <Link href="/store/settlements" className="text-sm font-semibold text-brand">
            התחשבנויות
          </Link>
        </div>
      </header>
      <RedeemForm />
    </main>
  );
}
