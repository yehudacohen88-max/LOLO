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
      title="כמעט סיימנו"
      lede="זה מסך הדגמה. לא נאספים פרטי כרטיס ולא מתבצע חיוב."
    >
      <GuestPaymentSummary />
    </FlowPage>
  );
}
