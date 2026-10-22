import type { Metadata } from "next";
import GuestPremiumEvent from "@/app/design/guest-premium-event";
import GuestPremiumShell from "@/app/design/guest-premium-shell";
import { guestPreviewPaths } from "@/app/design/guest-premium-sample";

export const metadata: Metadata = {
  title: "הדמיה — דף אירוע | LOLO",
  robots: { index: false, follow: false },
};

export default function GuestEventPreviewPage() {
  return (
    <GuestPremiumShell current={guestPreviewPaths.event}>
      <GuestPremiumEvent />
    </GuestPremiumShell>
  );
}
