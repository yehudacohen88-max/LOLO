import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { getAdminStore } from "@/lib/admin/stores";
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
  let store = null;
  let loadError = "";
  try {
    store = await getAdminStore(storeId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת בית העסק נכשלה.";
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8">
      <h1 className="text-2xl font-bold text-foreground sm:text-4xl">עריכת בית עסק</h1>
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {!loadError && !store ? (
        <p className="mt-6 text-base text-muted">בית העסק לא נמצא.</p>
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
