import { NextResponse } from "next/server";
import { readSimulatedHostNotices } from "@/lib/host/recovery-flow";
import { localDatabaseUiAllowed, supabaseUrlIsLoopback } from "@/lib/supabase/loopback-guard";

export const dynamic = "force-dynamic";

function requestIsLoopback(request: Request) {
  try {
    return supabaseUrlIsLoopback(request.url);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!localDatabaseUiAllowed() || !requestIsLoopback(request)) {
    return new NextResponse(null, { status: 404 });
  }
  const notices = readSimulatedHostNotices().map((notice) => ({
    id: notice.id,
    channel: notice.channel,
    template: notice.template,
    body: notice.body,
    simulated: notice.simulated,
    delivered: notice.delivered,
  }));
  return NextResponse.json({ notices });
}
