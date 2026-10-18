import type { Metadata } from "next";
import { Suspense } from "react";
import CreateFrame from "../../create-frame";
import CustomGiftForm from "./custom-gift-form";

export const metadata: Metadata = {
  title: "מתנה משלכם | LOLO",
  description: "הוספת מתנה עם תמונה, יעד וחנות",
};

export default function CustomGiftPage() {
  return (
    <CreateFrame step={2} title="מתנה משלכם" lede="שם, תמונה ויעד. החנות והתיאור לא חובה.">
      <Suspense fallback={null}>
        <CustomGiftForm />
      </Suspense>
    </CreateFrame>
  );
}
