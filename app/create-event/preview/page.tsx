import type { Metadata } from "next";
import CreateFrame from "../create-frame";
import EventPreview from "./event-preview";

export const metadata: Metadata = {
  title: "תצוגה מקדימה | LOLO",
};

export default function PreviewPage() {
  return (
    <CreateFrame step={5} title="תצוגה מקדימה" lede="כך האירוע ייראה לפני שיוצרים אותו">
      <EventPreview />
    </CreateFrame>
  );
}
