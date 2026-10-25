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
      title="עוד רגע מסיימים"
      lede="נשמח לדעת ממי המתנה."
      notice="תשלום הדגמה — לא מתבצע חיוב אמיתי"
    >
      <GuestDetailsForm />
    </FlowPage>
  );
}
