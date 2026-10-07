import type { Metadata } from "next";
import { headers } from "next/headers";
import VoucherCard from "@/components/voucher-card";
import { appPublicOrigin, originFromProxyHeaders } from "@/lib/app-url";
import { getPublicVoucherCard } from "@/lib/vouchers/repository";

export const metadata: Metadata = {
  title: "שובר מתנה | LOLO",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicVoucherPage({ params }: PageProps) {
  const { token } = await params;
  const headerStore = await headers();
  const origin = appPublicOrigin(originFromProxyHeaders(headerStore));

  let card = null;
  try {
    card = await getPublicVoucherCard(decodeURIComponent(token), origin);
  } catch (error) {
    console.error("[LOLO] public voucher page", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-16 text-center">
        <p className="text-base text-muted">השובר אינו זמין כרגע. נסו שוב מאוחר יותר.</p>
      </main>
    );
  }

  if (!card) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-16 text-center">
        <p className="text-4xl font-extrabold tracking-[0.28em] text-brand">LOLO</p>
        <h1 className="mt-8 text-2xl font-bold">השובר לא נמצא</h1>
        <p className="mt-3 text-base text-muted">הקישור אינו פעיל.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8 sm:py-12">
      <p className="no-print mb-6 text-center text-sm text-muted">שובר להצגה בחנות</p>
      <VoucherCard model={card} />
    </main>
  );
}
