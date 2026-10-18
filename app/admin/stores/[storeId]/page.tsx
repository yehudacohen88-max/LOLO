import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { getAdminStore } from "@/lib/admin/stores";
import { isUuid } from "@/lib/vouchers/input";
import RedemptionCodePanel from "../redemption-code-panel";
import StoreForm from "../store-form";

export const metadata: Metadata = {
  title: "עריכת בית עסק | LOLO",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storeId: string }>;
};

export default async function EditAdminStorePage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  const { storeId } = await params;
  if (!isUuid(storeId)) {
    notFound();
  }

  let store = null;
  let loadError = "";
  try {
    store = await getAdminStore(storeId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת בית העסק נכשלה.";
  }

  if (!loadError && !store) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8">
      <Link href="/admin/stores" className="text-sm font-semibold text-brand">
        לכל בתי העסק
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-4xl">עריכת בית עסק</h1>
      {loadError ? (
        <p className="mt-6 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand">{loadError}</p>
      ) : null}
      {store ? (
        <>
          <StoreForm store={store} />
          <RedemptionCodePanel storeId={store.id} />
        </>
      ) : null}
    </main>
  );
}
