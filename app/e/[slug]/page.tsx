import type { Metadata } from "next";
import GuestEventView from "./guest-event-view";

export const metadata: Metadata = {
  title: "האירוע | LOLO",
};

export default function GuestEventPage() {
  return <GuestEventView />;
}
