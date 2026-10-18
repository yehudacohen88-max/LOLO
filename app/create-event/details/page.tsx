import type { Metadata } from "next";
import CreateFrame from "../create-frame";
import EventDetailsForm from "./event-details-form";

export const metadata: Metadata = {
  title: "פרטי האירוע | LOLO",
  description: "עוד כמה פרטים והאירוע מוכן",
};

export default function EventDetailsPage() {
  return (
    <CreateFrame
      step={3}
      title="עוד כמה פרטים והאירוע מוכן"
      lede="עכשיו נוסיף את מה שהאורחים שלכם יראו"
    >
      <EventDetailsForm />
    </CreateFrame>
  );
}
