import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { handleHostImagePatch } from "@/lib/host/event-images";
import { HOST_SESSION_COOKIE } from "@/lib/host/session";
import { caughtErrorBody } from "@/lib/security/required-secret";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const jar = await cookies();
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  try {
    const result = await handleHostImagePatch({
      eventId,
      token: jar.get(HOST_SESSION_COOKIE)?.value,
      body,
      client: getSupabaseServiceClient,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const failure = caughtErrorBody(error, "שמירת התמונה נכשלה.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
