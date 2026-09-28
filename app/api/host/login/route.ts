import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hostAccessCodeMatches } from "@/lib/host/access-code";
import { slugFromHostIdentifier } from "@/lib/host/identifier";
import {
  createHostSessionToken,
  hostSessionCookieOptions,
  HOST_SESSION_COOKIE,
} from "@/lib/host/session";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "מזהה האירוע או קוד הניהול שגויים.";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      identifier?: string;
      accessCode?: string;
    };
    const slug = slugFromHostIdentifier(body.identifier ?? "");
    const accessCode = body.accessCode ?? "";

    if (!slug || !accessCode.trim()) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: event } = await supabase
      .from("events")
      .select("id, slug")
      .eq("slug", slug)
      .maybeSingle();

    const { data: access } = event
      ? await supabase
          .from("event_host_access")
          .select("code_hash")
          .eq("event_id", event.id)
          .maybeSingle()
      : { data: null };

    const hash = access?.code_hash ?? "";
    const matches = await hostAccessCodeMatches(accessCode, hash);

    if (!event || !hash || !matches) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const jar = await cookies();
    jar.set(
      HOST_SESSION_COOKIE,
      createHostSessionToken(event.id),
      hostSessionCookieOptions(),
    );

    return NextResponse.json({ eventId: event.id });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("חסר מפתח")
        ? error.message
        : GENERIC_ERROR;
    const status = message.includes("חסר מפתח") ? 500 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
