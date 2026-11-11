import type { Metadata } from "next";
import { Suspense } from "react";
import ShowcaseView from "./showcase-view";

export const metadata: Metadata = {
  title: "הדגמה | LOLO",
  robots: { index: false, follow: false },
};

export default function ShowcasePage() {
  return (
    <Suspense fallback={null}>
      <ShowcaseView />
    </Suspense>
  );
}
