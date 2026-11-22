import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { BETA_SESSION_COOKIE } from "@/lib/beta/gate";
import { HOST_SESSION_COOKIE } from "@/lib/host/session";
import { GIFT_IMAGE_BUCKET } from "@/lib/images/limits";
import { receiveImageUpload, type UploadStorage } from "@/lib/images/receive-upload";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonResult(result: { status: number; body: { error?: string; url?: string }; retryAfter?: number }) {
  if (result.status === 200 && result.body.url) {
    return NextResponse.json({ url: result.body.url });
  }
  const headers = result.retryAfter ? { "Retry-After": String(result.retryAfter) } : undefined;
  return NextResponse.json(
    { error: result.body.error ?? "העלאת התמונה נכשלה. נסו שוב." },
    { status: result.status, headers },
  );
}

function supabaseStorage(): UploadStorage {
  return {
    async upload(path, bytes, options) {
      const supabase = getSupabaseServiceClient();
      const { error } = await supabase.storage.from(GIFT_IMAGE_BUCKET).upload(path, bytes, options);
      return { error: error ? { message: error.message } : null };
    },
    getPublicUrl(path) {
      const supabase = getSupabaseServiceClient();
      return supabase.storage.from(GIFT_IMAGE_BUCKET).getPublicUrl(path);
    },
  };
}

export async function POST(request: Request) {
  const jar = await cookies();
  const result = await receiveImageUpload({
    request,
    hostToken: jar.get(HOST_SESSION_COOKIE)?.value,
    betaToken: jar.get(BETA_SESSION_COOKIE)?.value,
    storage: supabaseStorage(),
  });
  return jsonResult(result);
}
