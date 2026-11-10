import type { Metadata } from "next";
import { parseCelebrationLook } from "./celebration-look";
import GuestEventView from "./guest-event-view";

export const metadata: Metadata = {
  title: "האירוע | LOLO",
};

type GuestEventPageProps = {
  searchParams: Promise<{ look?: string | string[] }>;
};

export default async function GuestEventPage({ searchParams }: GuestEventPageProps) {
  const params = await searchParams;
  return <GuestEventView look={parseCelebrationLook(params.look)} />;
}
