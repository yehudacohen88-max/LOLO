import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getGuestFeeSettings } from "@/lib/admin/guest-fee";
import { getAdminSession } from "@/lib/admin/session";
import { SERVICE_UNAVAILABLE_MESSAGE } from "@/lib/security/required-secret";
import { settlementsEnabled } from "@/lib/settlements/availability";
import { SETTLEMENT_SCHEMA_MESSAGE } from "@/lib/settlements/messages";
import { readSettlementPolicy } from "@/lib/settlements/reports";
import FeeSettingsForm from "./fee-settings-form";
import SettlementSettingsForm from "./settlement-settings-form";

export const metadata: Metadata = {
  title: "הגדרות | LOLO",
};

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  let settings: Awaited<ReturnType<typeof getGuestFeeSettings>> | null = null;
  let loadError = "";
  let settlementPolicy: Awaited<ReturnType<typeof readSettlementPolicy>> | null = null;
  let settlementError = "";
  try {
    settings = await getGuestFeeSettings();
  } catch (error) {
    loadError =
      error instanceof Error && error.message
        ? error.message
        : SERVICE_UNAVAILABLE_MESSAGE;
  }

  if (settlementsEnabled()) {
    try {
      settlementPolicy = await readSettlementPolicy();
    } catch (error) {
      settlementError = error instanceof Error ? error.message : SETTLEMENT_SCHEMA_MESSAGE;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground sm:text-4xl">הגדרות</h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">
          עמלת השירות נגבית מהאורח בעת התשלום, בנוסף להשתתפות במתנה. היא לא נספרת ליעד המתנה.
          ברירת המחדל היא ללא עמלה.
        </p>
      </header>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {settings ? <FeeSettingsForm initial={settings} /> : null}
      {settlementsEnabled() ? (
        settlementError ? (
          <p className="mt-8 text-sm text-brand">{settlementError}</p>
        ) : settlementPolicy ? (
          <SettlementSettingsForm initial={settlementPolicy} />
        ) : null
      ) : null}
    </main>
  );
}
