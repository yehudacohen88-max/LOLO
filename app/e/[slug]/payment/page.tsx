import type { Metadata } from "next";
import { FlowPage } from "../flow-page";
import GuestPaymentSummary from "./payment-summary";

export const metadata: Metadata = {
  title: "תשלום | LOLO",
};

export default function GuestPaymentPage() {
  return (
    <FlowPage
      step="payment"
      title="תשלום"
      lede="גרסת בטא — תשלומים מדומים בלבד"
    >
      <GuestPaymentSummary />
    </FlowPage>
  );
}
