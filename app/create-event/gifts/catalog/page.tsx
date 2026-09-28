import type { Metadata } from "next";
import GiftCatalog from "./gift-catalog";

export const metadata: Metadata = {
  title: "קטלוג מתנות | LOLO",
  description: "בוחרים את המתנות שלכם",
};

export default function GiftCatalogPage() {
  return (
    <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <GiftCatalog />
    </div>
  );
}
