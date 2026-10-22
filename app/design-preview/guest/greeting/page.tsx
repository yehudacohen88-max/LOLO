import type { Metadata } from "next";
import { Suspense } from "react";
import GuestPremiumGreeting from "@/app/design/guest-premium-greeting";
import GuestPremiumShell from "@/app/design/guest-premium-shell";
import { guestPreviewPaths } from "@/app/design/guest-premium-sample";

export const metadata: Metadata = {
  title: "הדמיה — ברכה | LOLO",
  robots: { index: false, follow: false },
};

export default function GuestGreetingPreviewPage() {
  return (
    <GuestPremiumShell current={guestPreviewPaths.greeting}>
      <Suspense fallback={<p role="status">טוענים את הברכה...</p>}>
        <GuestPremiumGreeting />
      </Suspense>
    </GuestPremiumShell>
  );
}
