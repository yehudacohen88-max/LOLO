import "server-only";
import { GIFT_IMAGE_BUCKET } from "@/lib/images/limits";

function supabaseOrigin() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!raw) {
    return "";
  }

  return raw
    .replace(/\r/g, "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
}

export function isOwnGiftImageUrl(value: string) {
  const origin = supabaseOrigin();
  if (!origin || value.length > 500) {
    return false;
  }

  let url: URL;
  let base: URL;
  try {
    url = new URL(value);
    base = new URL(origin);
  } catch {
    return false;
  }

  const localHttp =
    url.protocol === "http:" &&
    (base.hostname === "localhost" || base.hostname === "127.0.0.1");
  if (url.origin !== base.origin || (url.protocol !== "https:" && !localHttp)) {
    return false;
  }

  const prefix = `/storage/v1/object/public/${GIFT_IMAGE_BUCKET}/`;
  return url.pathname.startsWith(prefix) && url.pathname.length > prefix.length;
}
