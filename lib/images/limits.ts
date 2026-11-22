export const GIFT_IMAGE_BUCKET = "gift-images";

/** Server hard cap. Client compression aims lower so a mobile photo fits a request. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const MAX_IMAGE_EDGE = 1600;

/** Decoded edge cap. Larger files are rejected before the bitmap is allocated. */
export const MAX_IMAGE_DIMENSION = 4096;

export const MAX_IMAGE_PIXELS = MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION;
