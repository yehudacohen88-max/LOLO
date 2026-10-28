import type { Metadata } from "next";
import { FlowPage } from "../flow-page";
import GuestDetailsForm from "./guest-details-form";

export const metadata: Metadata = {
  title: "פרטי האורח | LOLO",
};

export default function GuestDetailsPage() {
  return (
    <FlowPage
      step="details"
      title="למי נגיד תודה?"
      lede="השם והפרטים נשמרים אצל המארח, כדי שידע ממי המתנה."
    >
      <GuestDetailsForm />
    </FlowPage>
  );
}
