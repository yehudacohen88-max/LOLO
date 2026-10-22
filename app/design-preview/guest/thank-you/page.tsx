import type { Metadata } from "next";
import GuestPremiumShell from "@/app/design/guest-premium-shell";
import GuestPremiumThanks from "@/app/design/guest-premium-thanks";
import { guestPreviewPaths } from "@/app/design/guest-premium-sample";

export const metadata: Metadata = {
  title: "הדמיה — תודה | LOLO",
  robots: { index: false, follow: false },
};

export default function GuestThanksPreviewPage() {
  return (
    <GuestPremiumShell current={guestPreviewPaths.thanks}>
      <GuestPremiumThanks />
    </GuestPremiumShell>
  );
}
