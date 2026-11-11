"use client";

/* Host-uploaded image URLs are arbitrary, so next/image remote patterns cannot cover them. */
/* eslint-disable @next/next/no-img-element */

import { ILLUSTRATIVE_LABEL, giftPhotoFit, type ResolvedImage } from "@/lib/image-library";

export function JourneyFrame({
  image,
  decorative = false,
  gift = false,
}: {
  image: ResolvedImage;
  decorative?: boolean;
  gift?: boolean;
}) {
  if (!image.src || image.kind === "illustration") {
    return null;
  }

  const img = (
    <img
      src={image.src}
      alt={decorative ? "" : image.alt}
      data-image-source={image.kind}
      data-journey-photo=""
      data-gift-photo={gift ? "" : undefined}
      decoding="async"
    />
  );

  return (
    <div data-journey-frame="" data-fit={giftPhotoFit(image.src)}>
      {image.avif ? (
        <picture>
          <source srcSet={image.avif} type="image/avif" />
          {img}
        </picture>
      ) : (
        img
      )}
      {image.illustrative ? <span data-illustrative-label="">{ILLUSTRATIVE_LABEL}</span> : null}
    </div>
  );
}
