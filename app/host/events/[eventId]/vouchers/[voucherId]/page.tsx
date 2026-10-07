import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import VoucherCard from "@/components/voucher-card";
import { appPublicOrigin, originFromProxyHeaders } from "@/lib/app-url";
import {
  HOST_SESSION_COOKIE,
  readHostSessionToken,
} from "@/lib/host/session";
import { getHostVoucherCard } from "@/lib/vouchers/repository";

export const metadata: Metadata = {
  title: "שובר מתנה | LOLO",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ eventId: string; voucherId: string }>;
};

export default async function HostVoucherPage({ params }: PageProps) {
  const { eventId, voucherId } = await params;
  const jar = await cookies();
  const session = readHostSessionToken(jar.get(HOST_SESSION_COOKIE)?.value);
  if (!session || session.eventId !== eventId) {
    redirect("/host");
  }

  const headerStore = await headers();
  const origin = appPublicOrigin(originFromProxyHeaders(headerStore));

  let card = null;
  try {
    card = await getHostVoucherCard(eventId, voucherId, origin);
  } catch (error) {
    console.error("[LOLO] host voucher page", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-16 text-center">
        <p className="text-base text-muted">השובר אינו זמין כרגע. נסו שוב מאוחר יותר.</p>
      </main>
    );
  }

  if (!card) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8 sm:py-12">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Link href={`/host/events/${eventId}`} className="text-sm font-semibold text-brand">
          חזרה לניהול האירוע
        </Link>
        <p className="text-sm text-muted">להצגה בחנות</p>
      </div>
      <VoucherCard model={card} />
    </main>
  );
}
