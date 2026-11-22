import { readActiveUploadGrant, UPLOAD_GRANT_HEADER } from "@/lib/images/active-upload-grant";
import { ImagePrepareError, prepareImageFile } from "@/lib/images/prepare";

export async function uploadImageFile(file: File, kind: "gift" | "cover" = "gift") {
  const prepared = await prepareImageFile(file);
  const body = new FormData();
  body.set("file", prepared);
  body.set("kind", kind);
  const headers = new Headers();
  const grant = readActiveUploadGrant();
  if (grant) {
    headers.set(UPLOAD_GRANT_HEADER, grant);
  }

  let response: Response;
  try {
    response = await fetch("/api/uploads/images", {
      method: "POST",
      body,
      headers,
    });
  } catch {
    throw new ImagePrepareError("העלאת התמונה נכשלה. בדקו את החיבור ונסו שוב.");
  }

  let payload: { url?: unknown; error?: unknown } = {};
  try {
    payload = (await response.json()) as { url?: unknown; error?: unknown };
  } catch {
    payload = {};
  }

  if (!response.ok || typeof payload.url !== "string" || !payload.url) {
    const serverMessage = typeof payload.error === "string" ? payload.error.trim() : "";
    const message =
      serverMessage && serverMessage !== "השירות אינו זמין כרגע. נסו שוב מאוחר יותר."
        ? serverMessage
        : "העלאת התמונה נכשלה. נסו שוב.";
    throw new ImagePrepareError(message);
  }

  return payload.url;
}
