import type { Metadata } from "next";
import CreateFrame from "../../create-frame";
import GiftCatalog from "./gift-catalog";

export const metadata: Metadata = {
  title: "רעיונות למתנות | LOLO",
  description: "רעיונות להשראה למתנות האירוע",
};

export default function GiftCatalogPage() {
  return (
    <CreateFrame
      step={2}
      title="רעיונות להשראה"
      lede="בחרו רעיון ונמלא עבורכם שם, תיאור וסכום מוצע. אחר כך אפשר לשנות הכל, כולל התמונה."
    >
      <GiftCatalog />
    </CreateFrame>
  );
}
