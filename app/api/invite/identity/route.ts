import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { toPublicInviteIdentity } from "@/lib/events/public-guest";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { canonicalEventSlug } from "@/lib/events/slug";
import { guardGuestRead } from "@/lib/security/guest-guard";
import {
  INVITE_SESSION_COOKIE,
  readInviteSessionToken,
} from "@/lib/invite/session";

export async function GET(request: Request) {
  const limited = await guardGuestRead(request);
  if (limited) {
    return limited;
  }

  const slug = canonicalEventSlug(
    new URL(request.url).searchParams.get("slug") ?? "",
  );
  if (!slug) {
    return NextResponse.json(toPublicInviteIdentity({}));
  }

  const jar = await cookies();
  const session = readInviteSessionToken(
    jar.get(INVITE_SESSION_COOKIE)?.value,
  );
  if (!session) {
    return NextResponse.json(toPublicInviteIdentity({}));
  }

  const supabase = getSupabaseServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!event || event.id !== session.eventId) {
    return NextResponse.json(toPublicInviteIdentity({}));
  }

  return NextResponse.json(
    toPublicInviteIdentity({
      name: session.name,
      phone: session.phone,
    }),
  );
}
