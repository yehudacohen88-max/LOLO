import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import styles from "@/app/design/bold-host.module.css";
import { isUuid } from "@/lib/vouchers/input";
import VoucherCard from "@/components/voucher-card";
import { appPublicOrigin, originFromProxyHeaders } from "@/lib/app-url";
import { readStoredSessionVersion } from "@/lib/host/access-version";
import {
  HOST_SESSION_COOKIE,
  readHostSessionToken,
} from "@/lib/host/session";
import { hostSessionVersionMatches } from "@/lib/host/session-version";
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
  if (!isUuid(eventId) || !isUuid(voucherId)) {
    notFound();
  }
  const jar = await cookies();
  const session = readHostSessionToken(jar.get(HOST_SESSION_COOKIE)?.value);
  if (!session || session.eventId !== eventId) {
    redirect("/host");
  }
  let storedVersion: Awaited<ReturnType<typeof readStoredSessionVersion>>;
  try {
    storedVersion = await readStoredSessionVersion(session.eventId);
  } catch (error) {
    console.error("[LOLO] host voucher session", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return (
      <main className={styles.unavailable}>
        <p>השובר אינו זמין כרגע. נסו שוב מאוחר יותר.</p>
      </main>
    );
  }
  if (!hostSessionVersionMatches(session, storedVersion)) {
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
      <main className={styles.unavailable}>
        <p>השובר אינו זמין כרגע. נסו שוב מאוחר יותר.</p>
      </main>
    );
  }

  if (!card) {
    notFound();
  }

  const showAtStore =
    card.status === "ISSUED" || card.status === "PARTIALLY_REDEEMED";

  return (
    <main className={styles.voucherPage}>
      <div className={`${styles.voucherBar} no-print`}>
        <Link href={`/host/events/${eventId}`} className={styles.back}>
          חזרה לניהול האירוע
        </Link>
        <p>להצגה בחנות</p>
      </div>
      {showAtStore ? (
        <section className={`${styles.voucherIntro} no-print`}>
          <p className={styles.eyebrow}>הצעד הבא</p>
          <h1>הציגו את הכרטיס בחנות</h1>
          <p className={styles.help}>
            פתחו את הכרטיס על המסך, או שלחו את הקישור. בחנות סורקים את הקוד ומממשים את הסכום.
          </p>
        </section>
      ) : (
        <h1 className="no-print">כרטיס השובר</h1>
      )}
      <VoucherCard model={card} appearance="celebration" />
    </main>
  );
}
