const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const UNSUPPORTED =
  "סוג הקובץ לא נתמך. אפשר להעלות JPG, PNG או WEBP. קבצי HEIC ופורמטים אחרים לא נתמכים.";
const TOO_LARGE = "התמונה גדולה מדי. הגודל המרבי הוא 5MB.";
const UNREADABLE = "לא הצלחנו לקרוא את התמונה. נסו קובץ JPG או PNG אחר.";
const NETWORK = "העלאת התמונה נכשלה בגלל בעיית רשת או שרת. אפשר לנסות שוב.";

function isHeic(file: File | undefined) {
  if (!file) {
    return false;
  }
  return /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function isUnsupportedFile(file: File | undefined) {
  if (!file) {
    return false;
  }
  if (isHeic(file)) {
    return true;
  }
  return Boolean(file.type) && !file.type.startsWith("image/");
}

/** Maps the existing upload client and `/api/uploads/images` errors into Hebrew. */
export function describeImageUploadError(file: File | undefined, error: unknown) {
  const raw = error instanceof Error ? error.message : "";

  if (isUnsupportedFile(file) || /JPG, PNG או WEBP/.test(raw)) {
    return UNSUPPORTED;
  }

  if ((file && file.size > MAX_IMAGE_BYTES && /גדולה מדי/.test(raw)) || /גדולה מדי/.test(raw)) {
    return TOO_LARGE;
  }

  if (/לקרוא את התמונה|הקובץ ריק|לעבד את התמונה/.test(raw)) {
    return UNREADABLE;
  }

  return NETWORK;
}
