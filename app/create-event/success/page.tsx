import type { Metadata } from "next";
import { Suspense } from "react";
import CreateFrame from "../create-frame";
import SuccessActions from "./success-actions";

export const metadata: Metadata = {
  title: "האירוע מוכן | LOLO",
};

export default function SuccessPage() {
  return (
    <CreateFrame>
      <Suspense fallback={<p className="mt-10 text-center text-base text-muted">טוענים...</p>}>
        <SuccessActions />
      </Suspense>
    </CreateFrame>
  );
}
