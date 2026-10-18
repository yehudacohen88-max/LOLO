import type { Metadata } from "next";
import HostDashboard from "../events/[eventId]/host-dashboard";
import { EXAMPLE_DASHBOARD_NOTE, exampleDashboardData } from "./example-dashboard";

export const metadata: Metadata = {
  title: "ניהול האירוע — דוגמה | LOLO",
  robots: { index: false, follow: false },
};

export default function HostExamplePage() {
  return (
    <HostDashboard
      data={exampleDashboardData()}
      guestUrl="https://lolo.example/e/event-example"
      origin="https://lolo.example"
      exampleNote={EXAMPLE_DASHBOARD_NOTE}
    />
  );
}
