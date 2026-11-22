import "server-only";
import { ImageRejected, reencodeImage } from "@/lib/images/decode";
import { UPLOAD_GRANT_HEADER } from "@/lib/images/active-upload-grant";
import { MAX_IMAGE_BYTES } from "@/lib/images/limits";
import { extensionForImageType } from "@/lib/images/sniff";
import { authorizeImageUpload } from "@/lib/images/upload-auth";
import { clientIpFromVercelHeaders } from "@/lib/security/client-ip";
import { caughtErrorBody } from "@/lib/security/required-secret";
import { consumeUpload } from "@/lib/security/upload-limit";

export const MULTIPART_OVERHEAD = 256 * 1024;

const TOO_BIG = "התמונה גדולה מדי. נסו תמונה קטנה יותר.";
const UNREADABLE = "לא הצלחנו לקרוא את התמונה.";
const MISSING_FILE = "נא לבחור תמונה.";
const UNAUTHORIZED = "אין הרשאה להעלות תמונה.";
const RATE_LIMITED = "יותר מדי העלאות. נסו שוב מאוחר יותר.";
const FAILED = "העלאת התמונה נכשלה. נסו שוב.";

export type UploadStorage = {
  upload: (
    path: string,
    bytes: Uint8Array,
    options: { contentType: string; upsert: false; cacheControl: string },
  ) => Promise<{ error: { message: string } | null }>;
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
};

export async function receiveImageUpload(input: {
  request: Request;
  hostToken?: string;
  betaToken?: string;
  storage: UploadStorage;
  now?: number;
}) {
  const auth = await authorizeImageUpload({
    hostToken: input.hostToken,
    betaToken: input.betaToken,
    uploadToken: input.request.headers.get(UPLOAD_GRANT_HEADER) ?? undefined,
    now: input.now,
  });
  if (!auth.ok) {
    return { status: 401, body: { error: UNAUTHORIZED } };
  }

  const contentLength = Number(input.request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_IMAGE_BYTES + MULTIPART_OVERHEAD
  ) {
    return { status: 413, body: { error: TOO_BIG } };
  }

  const limit = consumeUpload(
    {
      ip: clientIpFromVercelHeaders(input.request.headers),
      principal: auth.principal,
    },
    input.now ?? Date.now(),
  );
  if (!limit.ok) {
    return {
      status: 429,
      body: { error: RATE_LIMITED },
      retryAfter: limit.retryAfterSeconds,
    };
  }

  let form: FormData;
  try {
    form = await input.request.formData();
  } catch {
    return { status: 400, body: { error: UNREADABLE } };
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return { status: 400, body: { error: MISSING_FILE } };
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return { status: 400, body: { error: TOO_BIG } };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return { status: 400, body: { error: TOO_BIG } };
  }

  let encoded: { bytes: Uint8Array; contentType: "image/jpeg" | "image/png" | "image/webp" };
  try {
    encoded = await reencodeImage(bytes);
  } catch (error) {
    if (error instanceof ImageRejected) {
      return { status: 400, body: { error: error.message } };
    }
    return { status: 400, body: { error: UNREADABLE } };
  }

  const kind = form.get("kind") === "cover" ? "covers" : "gifts";
  const path = `${kind}/${crypto.randomUUID()}.${extensionForImageType(encoded.contentType)}`;

  try {
    const { error } = await input.storage.upload(path, encoded.bytes, {
      contentType: encoded.contentType,
      upsert: false,
      cacheControl: "31536000",
    });
    if (error) {
      console.error(
        "[LOLO] Image upload failed. If the gift-images bucket is missing, run supabase/custom-gifts.sql.",
        { message: error.message },
      );
      return { status: 500, body: { error: FAILED } };
    }

    const { data } = input.storage.getPublicUrl(path);
    if (!data.publicUrl) {
      console.error("[LOLO] Image upload returned no public URL.");
      return { status: 500, body: { error: FAILED } };
    }
    return { status: 200, body: { url: data.publicUrl } };
  } catch (error) {
    console.error("[LOLO] Image upload failed.", error);
    const body = caughtErrorBody(error, FAILED);
    return { status: body.status === 503 ? 503 : 500, body: { error: body.error } };
  }
}
