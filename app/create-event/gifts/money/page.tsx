import type { Metadata } from "next";
import CreateFrame from "../../create-frame";
import MoneyGiftForm from "./money-gift-form";

export const metadata: Metadata = {
  title: "מתנה כספית | LOLO",
  description: "הגדירו איך האורחים יוכלו להעניק לכם מתנה",
};

export default function MoneyGiftPage() {
  return (
    <CreateFrame
      step={2}
      title="מתנה כספית"
      lede="הגדירו איך האורחים יוכלו להעניק לכם מתנה"
    >
      <MoneyGiftForm />
    </CreateFrame>
  );
}
