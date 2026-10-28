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
      title="מוסיפים ברכה אישית"
      lede="כמה מילים חמות. אפשר גם להמשיך בלי."
    >
      <GuestGreetingForm />
    </FlowPage>
  );
}
