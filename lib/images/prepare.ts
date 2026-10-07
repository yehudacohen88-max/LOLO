import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE } from "@/lib/images/limits";

const UNSUPPORTED_MESSAGE = "אפשר להעלות תמונת JPG, PNG או WEBP.";
const UNREADABLE_MESSAGE = "לא הצלחנו לקרוא את התמונה. נסו JPG או PNG.";
const TOO_BIG_MESSAGE = "התמונה גדולה מדי. נסו תמונה קטנה יותר.";

export class ImagePrepareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagePrepareError";
  }
}

type Drawable = {
  width: number;
  height: number;
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  cleanup: () => void;
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function loadHtmlImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("unreadable"));
    image.src = url;
  });
}

async function loadDrawable(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      if (bitmap.width > 0 && bitmap.height > 0) {
        return {
          width: bitmap.width,
          height: bitmap.height,
          draw: (context, width, height) => {
            context.drawImage(bitmap, 0, 0, width, height);
          },
          cleanup: () => bitmap.close(),
        };
      }
      bitmap.close();
    } catch {
      // Fall through to an Image element for formats the bitmap decoder rejects.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await loadHtmlImage(url);
    if (image.naturalWidth < 1 || image.naturalHeight < 1) {
      throw new Error("empty");
    }
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (context, width, height) => {
        context.drawImage(image, 0, 0, width, height);
      },
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImagePrepareError(UNREADABLE_MESSAGE);
  }
}

async function encodeUnderLimit(canvas: HTMLCanvasElement) {
  const qualities = [0.82, 0.68, 0.52];
  for (const quality of qualities) {
    const webp = await canvasToBlob(canvas, "image/webp", quality);
    if (webp && webp.size > 0 && webp.size <= MAX_IMAGE_BYTES) {
      return webp;
    }
    const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
    if (jpeg && jpeg.size > 0 && jpeg.size <= MAX_IMAGE_BYTES) {
      return jpeg;
    }
  }
  return null;
}

export async function prepareImageFile(file: File) {
  if (file.size <= 0) {
    throw new ImagePrepareError("הקובץ ריק. בחרו תמונה אחרת.");
  }

  if (file.type && !file.type.startsWith("image/")) {
    throw new ImagePrepareError(UNSUPPORTED_MESSAGE);
  }

  const drawable = await loadDrawable(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(drawable.width, drawable.height));
    const width = Math.max(1, Math.round(drawable.width * scale));
    const height = Math.max(1, Math.round(drawable.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new ImagePrepareError("לא הצלחנו לעבד את התמונה.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    drawable.draw(context, width, height);

    const blob = await encodeUnderLimit(canvas);
    if (!blob) {
      throw new ImagePrepareError(TOO_BIG_MESSAGE);
    }

    const type = blob.type === "image/webp" ? "image/webp" : "image/jpeg";
    const name = type === "image/webp" ? "photo.webp" : "photo.jpg";
    return new File([blob], name, { type });
  } finally {
    drawable.cleanup();
  }
}
