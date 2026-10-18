import type { Metadata } from "next";
import { FlowPage } from "../flow-page";
import ThankYouView from "./thank-you-view";

export const metadata: Metadata = {
  title: "תודה | LOLO",
};

export default function ThankYouPage() {
  return (
    <FlowPage step="thanks" title="תודה" lede="ההשתתפות שלכם כבר חלק מהמתנה.">
      <ThankYouView />
    </FlowPage>
  );
}
