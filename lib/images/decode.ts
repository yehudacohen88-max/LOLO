import "server-only";
import sharp from "sharp";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
} from "@/lib/images/limits";
import { inspectImage, type SniffedImageType } from "@/lib/images/sniff";

const UNSUPPORTED = "אפשר להעלות תמונת JPG, PNG או WEBP.";
const UNREADABLE = "לא הצלחנו לקרוא את התמונה.";
const TOO_BIG = "התמונה גדולה מדי. נסו תמונה קטנה יותר.";

sharp.cache(false);
sharp.concurrency(1);

export class ImageRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageRejected";
  }
}

function dimensionsFit(width: number, height: number) {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= 1 &&
    height >= 1 &&
    width <= MAX_IMAGE_DIMENSION &&
    height <= MAX_IMAGE_DIMENSION &&
    width * height <= MAX_IMAGE_PIXELS
  );
}

function sharpOptions() {
  return {
    failOn: "error" as const,
    limitInputPixels: MAX_IMAGE_PIXELS,
    sequentialRead: true,
    unlimited: false,
    pages: 1,
    animated: false,
  };
}

function rejectedFromDecoder(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/pixel limit|exceeds pixel/i.test(message)) {
    return new ImageRejected(TOO_BIG);
  }
  return new ImageRejected(UNREADABLE);
}

function openImage(bytes: Uint8Array) {
  return sharp(bytes, sharpOptions());
}

async function encodeWithinCap(bytes: Uint8Array, type: SniffedImageType) {
  const qualities = type === "image/png" ? [null] : [82, 68, 54];
  for (const quality of qualities) {
    try {
      const image = openImage(bytes).rotate();
      const encoded =
        type === "image/png"
          ? await image.png({ compressionLevel: 9 }).toBuffer()
          : type === "image/webp"
            ? await image.webp({ quality: quality ?? 82 }).toBuffer()
            : await image.jpeg({ quality: quality ?? 82 }).toBuffer();
      if (encoded.byteLength > 0 && encoded.byteLength <= MAX_IMAGE_BYTES) {
        return encoded;
      }
    } catch (error) {
      throw error instanceof ImageRejected ? error : rejectedFromDecoder(error);
    }
  }
  throw new ImageRejected(TOO_BIG);
}

/**
 * Checks a full JPEG, PNG, or WEBP container, refuses oversized dimensions
 * before allocating a bitmap, decodes with a pixel cap, and returns a new
 * encoding. The new file has no trailing payload and no original metadata.
 */
export async function reencodeImage(bytes: Uint8Array) {
  const inspected = inspectImage(bytes);
  if (!inspected.ok) {
    throw new ImageRejected(inspected.reason === "unsupported" ? UNSUPPORTED : UNREADABLE);
  }
  if (!dimensionsFit(inspected.width, inspected.height)) {
    throw new ImageRejected(TOO_BIG);
  }

  try {
    const metadata = await openImage(bytes).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const pages = metadata.pages ?? 1;
    if (pages > 1 || !dimensionsFit(width, height)) {
      throw new ImageRejected(TOO_BIG);
    }
    const format = metadata.format;
    const matches =
      (inspected.type === "image/jpeg" && format === "jpeg") ||
      (inspected.type === "image/png" && format === "png") ||
      (inspected.type === "image/webp" && format === "webp");
    if (!matches) {
      throw new ImageRejected(UNREADABLE);
    }
  } catch (error) {
    throw error instanceof ImageRejected ? error : rejectedFromDecoder(error);
  }

  const encoded = await encodeWithinCap(bytes, inspected.type);
  const again = inspectImage(encoded);
  if (!again.ok || again.type !== inspected.type) {
    throw new ImageRejected(UNREADABLE);
  }
  return { bytes: encoded, contentType: inspected.type };
}
