import type { Metadata } from "next";
import GiftCatalog from "./gift-catalog";

export const metadata: Metadata = {
  title: "רעיונות למתנות | LOLO",
  description: "רעיונות להשראה למתנות האירוע",
};

export default function GiftCatalogPage() {
  return (
    <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <GiftCatalog />
    </div>
  );
}
