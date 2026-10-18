import type { ReactNode } from "react";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type UploadFailure = {
  message: ReactNode;
  retryable: boolean;
  unsupported: boolean;
};

function Formats() {
  return <bdi dir="ltr">JPG, PNG, WEBP</bdi>;
}

function unsupportedMessage(): UploadFailure {
  return {
    retryable: false,
    unsupported: true,
    message: (
      <>
        סוג הקובץ לא נתמך. אפשר להעלות <Formats />. קבצי <bdi dir="ltr">HEIC</bdi>{" "}
        ופורמטים אחרים לא נתמכים.
      </>
    ),
  };
}

function tooLargeMessage(): UploadFailure {
  return {
    retryable: true,
    unsupported: false,
    message: (
      <>
        התמונה גדולה מדי. הגודל המרבי הוא <bdi dir="ltr">5MB</bdi>.
      </>
    ),
  };
}

function unreadableMessage(): UploadFailure {
  return {
    retryable: true,
    unsupported: false,
    message: (
      <>
        לא הצלחנו לקרוא את התמונה. נסו קובץ <bdi dir="ltr">JPG</bdi> או{" "}
        <bdi dir="ltr">PNG</bdi> אחר.
      </>
    ),
  };
}

function networkMessage(): UploadFailure {
  return {
    retryable: true,
    unsupported: false,
    message: "העלאת התמונה נכשלה בגלל בעיית רשת או שרת. אפשר לנסות שוב.",
  };
}

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
export function describeImageUploadError(file: File | undefined, error: unknown): UploadFailure {
  const raw = error instanceof Error ? error.message : "";

  if (isUnsupportedFile(file) || /JPG, PNG או WEBP/.test(raw)) {
    return unsupportedMessage();
  }

  if (/גדולה מדי/.test(raw) || (file && file.size > MAX_IMAGE_BYTES && /גדולה מדי/.test(raw))) {
    return tooLargeMessage();
  }

  if (/לקרוא את התמונה|הקובץ ריק|לעבד את התמונה/.test(raw)) {
    return unreadableMessage();
  }

  return networkMessage();
}
