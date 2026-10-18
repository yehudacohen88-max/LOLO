import type { Metadata } from "next";
import CreateFrame from "../create-frame";
import GiftChoiceForm from "./gift-choice-form";

export const metadata: Metadata = {
  title: "בחירת מתנות | LOLO",
  description: "איך תרצו לקבל מתנות?",
};

export default function GiftChoicePage() {
  return (
    <CreateFrame
      step={2}
      title="איך תרצו לקבל מתנות?"
      lede="בחרו את האפשרות שמתאימה לאירוע שלכם"
    >
      <GiftChoiceForm />
    </CreateFrame>
  );
}
