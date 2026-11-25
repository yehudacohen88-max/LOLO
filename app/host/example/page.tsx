import type { Metadata } from "next";
import { legalDraftsEnabledFromEnv } from "@/lib/legal/flag";
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
  const view = params.view;
  const sampleView =
    view === "empty" || view === "zero" || view === "nogoal" || view === "many" || view === "ratios"
      ? view
      : "sample";
  const interactive = view === "live" && process.env.LOLO_HOST_SAMPLE_ACTIONS === "1";

  return (
    <HostDashboard
      data={exampleDashboardData(sampleView)}
      guestUrl="https://lolo.example/e/event-example"
      origin="https://lolo.example"
      exampleNote={EXAMPLE_DASHBOARD_NOTE}
      actionsEnabled={interactive}
      legalDrafts={legalDraftsEnabledFromEnv()}
    />
  );
}
