import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getHostDashboardData } from "@/lib/host/dashboard";
import {
  HOST_SESSION_COOKIE,
  readHostSessionToken,
} from "@/lib/host/session";
import { appPublicOrigin } from "@/lib/app-url";
import HostDashboard from "./host-dashboard";

type HostEventPageProps = {
  params: Promise<{ eventId: string }>;
};

export const metadata: Metadata = {
  title: "ניהול האירוע | LOLO",
};

function requestOriginFromHeaders(
  headerStore: Awaited<ReturnType<typeof headers>>,
) {
  const host =
    headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const protocol =
    headerStore.get("x-forwarded-proto") ||
    (host.startsWith("localhost") ? "http" : "https");
  if (!host) {
    return "";
  }
  return `${protocol}://${host}`;
}

export default async function HostEventDashboardPage({
  params,
}: HostEventPageProps) {
  const { eventId } = await params;
  const jar = await cookies();
  const session = readHostSessionToken(jar.get(HOST_SESSION_COOKIE)?.value);

  if (!session || session.eventId !== eventId) {
    redirect("/host");
  }

  let data: Awaited<ReturnType<typeof getHostDashboardData>>;
  try {
    data = await getHostDashboardData(session.eventId);
  } catch (error) {
    console.error("[LOLO] host dashboard failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-16 text-center">
        <p className="text-base text-muted">
          השירות אינו זמין כרגע. נסו שוב מאוחר יותר.
        </p>
      </main>
    );
  }
  if (!data || data.eventId !== session.eventId) {
    notFound();
  }

  const headerStore = await headers();
  const origin = appPublicOrigin(requestOriginFromHeaders(headerStore));
  const guestUrl = origin ? `${origin}${data.guestPath}` : data.guestPath;

  return <HostDashboard data={data} guestUrl={guestUrl} origin={origin} />;
}
