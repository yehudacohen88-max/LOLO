import type { Metadata } from "next";
import CreateFrame from "../../create-frame";
import OrganizeGifts from "./organize-gifts";

export const metadata: Metadata = {
  title: "המתנות לאירוע | LOLO",
  description: "הוסיפו את המתנות שהייתם שמחים לקבל",
};

export default function OrganizeGiftsPage() {
  return (
    <CreateFrame
      step={2}
      title="המתנות לאירוע"
      lede="הוסיפו מתנות משלכם וסדרו אותן לפי עדיפות. אפשר לשייך חנות לכל מתנה. היעד הוא מטרה, והאורחים יכולים להשתתף בכל סכום."
    >
      <OrganizeGifts />
    </CreateFrame>
  );
}
