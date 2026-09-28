import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { normalizeEventSlug } from "@/lib/events/slug";
import {
  INVITE_SESSION_COOKIE,
  readInviteSessionToken,
} from "@/lib/invite/session";

export async function GET(request: Request) {
  const slug = normalizeEventSlug(
    new URL(request.url).searchParams.get("slug") ?? "",
  );
  if (!slug) {
    return NextResponse.json({ name: "", phone: "" });
  }

  const jar = await cookies();
  const session = readInviteSessionToken(
    jar.get(INVITE_SESSION_COOKIE)?.value,
  );
  if (!session) {
    return NextResponse.json({ name: "", phone: "" });
  }

  const supabase = getSupabaseServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!event || event.id !== session.eventId) {
    return NextResponse.json({ name: "", phone: "" });
  }

  return NextResponse.json({
    name: session.name,
    phone: session.phone,
  });
}
