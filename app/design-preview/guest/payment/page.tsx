import type { Metadata } from "next";
import { Suspense } from "react";
import GuestPremiumPayment from "@/app/design/guest-premium-payment";
import GuestPremiumShell from "@/app/design/guest-premium-shell";
import { guestPreviewPaths } from "@/app/design/guest-premium-sample";

export const metadata: Metadata = {
  title: "הדמיה — תשלום | LOLO",
  robots: { index: false, follow: false },
};

export default function GuestPaymentPreviewPage() {
  return (
    <GuestPremiumShell current={guestPreviewPaths.payment}>
      <Suspense fallback={<p role="status">טוענים את התשלום...</p>}>
        <GuestPremiumPayment />
      </Suspense>
    </GuestPremiumShell>
  );
}
