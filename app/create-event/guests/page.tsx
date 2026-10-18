import type { Metadata } from "next";
import CreateFrame from "../create-frame";
import GuestsForm from "./guests-form";

export const metadata: Metadata = {
  title: "הזמנת אורחים | LOLO",
  description: "את מי מזמינים?",
};

export default function GuestsPage() {
  return (
    <CreateFrame
      step={4}
      title="את מי מזמינים?"
      lede="הוסיפו את האורחים שלכם. את ההזמנה נשלח בהמשך."
    >
      <GuestsForm />
    </CreateFrame>
  );
}
