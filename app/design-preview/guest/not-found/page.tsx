import type { Metadata } from "next";
import GuestPremiumMissing from "@/app/design/guest-premium-missing";
import GuestPremiumShell from "@/app/design/guest-premium-shell";
import { guestPreviewPaths } from "@/app/design/guest-premium-sample";

export const metadata: Metadata = {
  title: "הדמיה — הקישור לא נמצא | LOLO",
  robots: { index: false, follow: false },
};

export default function GuestMissingPreviewPage() {
  return (
    <GuestPremiumShell current={guestPreviewPaths.missing}>
      <GuestPremiumMissing />
    </GuestPremiumShell>
  );
}
