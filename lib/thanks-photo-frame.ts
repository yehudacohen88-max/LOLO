import { giftPhotoFit, IMAGE_LIBRARY } from "@/lib/image-library";

export type ThanksFramePlan = {
  fit: "contain" | "cover" | "mat";
  aspectRatio: string;
  objectPosition: string;
};

const PORTRAIT = "4 / 5";
const LANDSCAPE = "3 / 2";
const SQUARE = "1 / 1";

function containPlan(): ThanksFramePlan {
  return { fit: "contain", aspectRatio: PORTRAIT, objectPosition: "center" };
}

function libraryEntry(src: string) {
  const path = src.split("?")[0] ?? "";
  if (!path) {
    return null;
  }
  return IMAGE_LIBRARY.find((item) => item.file === path || item.avif === path) ?? null;
}

function near(ratio: number, target: number) {
  return Math.abs(ratio - target) / target <= 0.08;
}

/** Cover a frame close to the photo, or mat an extreme ratio so nothing is cropped away. */
export function thanksPlanForRatio(
  width: number,
  height: number,
  objectPosition?: string,
): ThanksFramePlan {
  const ratio = width > 0 && height > 0 ? width / height : Number.NaN;
  const focal = objectPosition?.trim() || (ratio < 1 ? "center 40%" : "center");
  if (!Number.isFinite(ratio)) {
    return { fit: "cover", aspectRatio: PORTRAIT, objectPosition: focal };
  }
  if (ratio >= 1.95 || ratio <= 0.62) {
    return {
      fit: "mat",
      aspectRatio: ratio >= 1 ? LANDSCAPE : PORTRAIT,
      objectPosition: "center",
    };
  }
  if (near(ratio, 4 / 5)) {
    return { fit: "cover", aspectRatio: PORTRAIT, objectPosition: focal };
  }
  if (near(ratio, 1)) {
    return { fit: "cover", aspectRatio: SQUARE, objectPosition: focal };
  }
  if (near(ratio, 3 / 2)) {
    return { fit: "cover", aspectRatio: LANDSCAPE, objectPosition: focal };
  }
  return { fit: "cover", aspectRatio: `${width} / ${height}`, objectPosition: focal };
}

/** Library defaults and the bundled espresso cutout. Host uploads use a measurement instead. */
export function thanksPlanForLibrary(src: string): ThanksFramePlan | null {
  if (giftPhotoFit(src) === "contain") {
    return containPlan();
  }
  const image = libraryEntry(src);
  if (!image) {
    return null;
  }
  if (image.fit === "contain") {
    return containPlan();
  }
  return thanksPlanForRatio(image.width, image.height, image.objectPosition);
}

export function thanksPlanForMeasurement(width: number, height: number, src: string): ThanksFramePlan {
  if (giftPhotoFit(src) === "contain") {
    return containPlan();
  }
  const image = libraryEntry(src);
  if (image?.fit === "contain") {
    return containPlan();
  }
  return thanksPlanForRatio(width, height, image?.objectPosition);
}
