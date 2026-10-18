import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import OrganizeGifts from "./organize-gifts";

export const metadata: Metadata = {
  title: "המתנות לאירוע | LOLO",
  description: "הוסיפו את המתנות שהייתם שמחים לקבל",
};

export default function OrganizeGiftsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          step={2}
          total={4}
          title="המתנות לאירוע"
          subtitle="הוסיפו מתנות משלכם וסדרו אותן לפי עדיפות. אפשר לשייך חנות לכל מתנה. היעד הוא מטרה, והאורחים יכולים להשתתף בכל סכום."
        />

        <OrganizeGifts />
      </main>
    </div>
  );
}
