import type { Metadata } from "next";
import { Suspense } from "react";
import GuestPremiumDetails from "@/app/design/guest-premium-details";
import GuestPremiumShell from "@/app/design/guest-premium-shell";
import { guestPreviewPaths } from "@/app/design/guest-premium-sample";

export const metadata: Metadata = {
  title: "הדמיה — פרטי האורח | LOLO",
  robots: { index: false, follow: false },
};

export default function GuestDetailsPreviewPage() {
  return (
    <GuestPremiumShell current={guestPreviewPaths.details}>
      <Suspense fallback={<p role="status">טוענים את הפרטים...</p>}>
        <GuestPremiumDetails />
      </Suspense>
    </GuestPremiumShell>
  );
}
