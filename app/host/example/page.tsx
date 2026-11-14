import type { Metadata } from "next";
import HostDashboard from "../events/[eventId]/host-dashboard";
import { EXAMPLE_DASHBOARD_NOTE, exampleDashboardData } from "./example-dashboard";

export const metadata: Metadata = {
  title: "ניהול האירוע — דוגמה | LOLO",
  robots: { index: false, follow: false },
};

type ExamplePageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function HostExamplePage({ searchParams }: ExamplePageProps) {
  const params = await searchParams;
  const empty = params.view === "empty";
  const interactive = params.view === "live" && process.env.LOLO_HOST_SAMPLE_ACTIONS === "1";

  return (
    <HostDashboard
      data={exampleDashboardData(empty ? "empty" : "sample")}
      guestUrl="https://lolo.example/e/event-example"
      origin="https://lolo.example"
      exampleNote={EXAMPLE_DASHBOARD_NOTE}
      actionsEnabled={interactive}
    />
  );
}
