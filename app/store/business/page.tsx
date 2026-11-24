import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readStoreSelfProfile } from "@/lib/desk/store-profile";
import { getStoreSession } from "@/lib/store/session";
import StoreLogoutButton from "../redeem/logout-button";
import StoreDeskLinks from "../store-links";
import BusinessForm from "./business-form";

export const metadata: Metadata = {
  title: "פרטי בית העסק | LOLO",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StoreBusinessPage() {
  const session = await getStoreSession();
  if (!session) {
    redirect("/store");
  }

  let profile = null;
  let loadError = "";
  try {
    profile = await readStoreSelfProfile(session.storeId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת הפרטים נכשלה.";
  }

  const done = profile?.checklist.filter((item) => item.done).length ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-2xl font-extrabold tracking-[0.22em] text-brand">
            LOLO
          </Link>
          <h1 className="mt-4 text-2xl font-bold">פרטי בית העסק</h1>
          <p className="mt-1 text-sm text-muted">{profile?.name || "בית העסק"}</p>
        </div>
        <StoreLogoutButton />
      </header>
      <StoreDeskLinks />
      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {profile ? (
        <>
          <section className="mt-6 rounded-3xl border border-border bg-white p-5">
            <h2 className="text-lg font-bold">השלמת פרטים</h2>
            <p className="mt-2 text-sm text-muted">
              {done.toLocaleString("he-IL")} מתוך {profile.checklist.length.toLocaleString("he-IL")}{" "}
              שדות מלאים. שם הכניסה נשאר אצל LOLO.
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {profile.checklist.map((item) => (
                <li key={item.key}>
                  {item.done ? "מולא" : "חסר"} · {item.label}
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-6 rounded-3xl border border-border bg-white p-5 text-sm leading-relaxed">
            <h2 className="text-lg font-bold">נקבע בניהול</h2>
            <p className="mt-2 text-muted">
              עמלה, ימי תשלום ותנאי השובר לא משתנים מכאן. שדה ריק אינו 0.
            </p>
            <dl className="mt-4 grid gap-3">
              <div>
                <dt className="text-muted">שם כניסה</dt>
                <dd className="font-semibold" dir="ltr">
                  {profile.slug}
                </dd>
              </div>
              <div>
                <dt className="text-muted">עמלה</dt>
                <dd className="font-semibold">{profile.commissionLabel}</dd>
              </div>
              <div>
                <dt className="text-muted">ימי תשלום</dt>
                <dd className="font-semibold">{profile.paymentTermsLabel}</dd>
              </div>
              <div>
                <dt className="text-muted">אופן התחשבנות</dt>
                <dd className="font-semibold">{profile.settlementLabel}</dd>
              </div>
              <div>
                <dt className="text-muted">תוקף שובר</dt>
                <dd className="font-semibold">{profile.voucherValidityLabel}</dd>
              </div>
              <div>
                <dt className="text-muted">מימוש חלקי</dt>
                <dd className="font-semibold">{profile.partialLabel}</dd>
              </div>
              <div>
                <dt className="text-muted">טעינה</dt>
                <dd className="font-semibold">{profile.topupLabel}</dd>
              </div>
              <div>
                <dt className="text-muted">אופן מימוש</dt>
                <dd className="font-semibold">{profile.voucherRedemptionMethod}</dd>
              </div>
            </dl>
          </section>
          <BusinessForm store={profile} />
        </>
      ) : null}
    </main>
  );
}
