import type { Metadata } from "next";
import { FlowPage } from "../flow-page";
import GuestGreetingForm from "./greeting-form";

export const metadata: Metadata = {
  title: "ברכה | LOLO",
};

export default function GuestGreetingPage() {
  return (
    <FlowPage
      step="greeting"
      title="משאירים ברכה"
      lede="כמה מילים חמות. אפשר גם להמשיך בלי."
    >
      <GuestGreetingForm />
    </FlowPage>
  );
}
