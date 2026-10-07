import { NextResponse } from "next/server";
import { extensionForImageType, sniffImageType } from "@/lib/images/sniff";
import { GIFT_IMAGE_BUCKET, MAX_IMAGE_BYTES } from "@/lib/images/limits";
import { clientIpFromRequest } from "@/lib/security/login-limit";
import { consumeUpload } from "@/lib/security/upload-limit";
import { caughtErrorBody } from "@/lib/security/required-secret";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MULTIPART_OVERHEAD = 256 * 1024;

function jsonError(error: string, status: number, retryAfter?: number) {
  const headers = retryAfter ? { "Retry-After": String(retryAfter) } : undefined;
  return NextResponse.json({ error }, { status, headers });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_IMAGE_BYTES + MULTIPART_OVERHEAD
  ) {
    return jsonError("התמונה גדולה מדי. נסו תמונה קטנה יותר.", 413);
  }

  const limit = consumeUpload(clientIpFromRequest(request));
  if (!limit.ok) {
    return jsonError(
      "יותר מדי העלאות. נסו שוב מאוחר יותר.",
      429,
      limit.retryAfterSeconds,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("לא הצלחנו לקרוא את התמונה.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("נא לבחור תמונה.", 400);
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return jsonError("התמונה גדולה מדי. נסו תמונה קטנה יותר.", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return jsonError("התמונה גדולה מדי. נסו תמונה קטנה יותר.", 400);
  }

  const contentType = sniffImageType(bytes);
  if (!contentType) {
    return jsonError("אפשר להעלות תמונת JPG, PNG או WEBP.", 400);
  }

  const kind = form.get("kind") === "cover" ? "covers" : "gifts";
  const path = `${kind}/${crypto.randomUUID()}.${extensionForImageType(contentType)}`;

  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.storage.from(GIFT_IMAGE_BUCKET).upload(path, bytes, {
      contentType,
      upsert: false,
      cacheControl: "31536000",
    });

    if (error) {
      console.error(
        "[LOLO] Image upload failed. If the gift-images bucket is missing, run supabase/custom-gifts.sql.",
        { message: error.message },
      );
      return jsonError("העלאת התמונה נכשלה. נסו שוב.", 500);
    }

    const { data } = supabase.storage.from(GIFT_IMAGE_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) {
      console.error("[LOLO] Image upload returned no public URL.");
      return jsonError("העלאת התמונה נכשלה. נסו שוב.", 500);
    }

    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error("[LOLO] Image upload failed.", error);
    const body = caughtErrorBody(error, "העלאת התמונה נכשלה. נסו שוב.");
    return jsonError(body.error, body.status === 503 ? 503 : 500);
  }
}
