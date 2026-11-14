"use client";

/* Host-uploaded image URLs are arbitrary, so next/image remote patterns cannot cover them. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { ILLUSTRATIVE_LABEL, giftPhotoFit, type ResolvedImage } from "@/lib/image-library";
import {
  thanksPlanForLibrary,
  thanksPlanForMeasurement,
  type ThanksFramePlan,
} from "@/lib/thanks-photo-frame";

const CREAM_CUTOUT: ThanksFramePlan = {
  fit: "contain",
  aspectRatio: "4 / 5",
  objectPosition: "center",
};

export function JourneyFrame({
  image,
  decorative = false,
  gift = false,
  thanks = false,
}: {
  image: ResolvedImage;
  decorative?: boolean;
  gift?: boolean;
  /** Thank-you gift frame. Other journey steps keep the shared cover/contain rules. */
  thanks?: boolean;
}) {
  const photoRef = useRef<HTMLImageElement>(null);
  const [measured, setMeasured] = useState<{ src: string; plan: ThanksFramePlan } | null>(null);
  const cutout = giftPhotoFit(image.src) === "contain";
  const hostPlan =
    thanks && image.kind === "host" && !cutout && measured?.src === image.src ? measured.plan : null;
  const plan: ThanksFramePlan | null = !thanks
    ? null
    : cutout
      ? CREAM_CUTOUT
      : image.kind === "library"
        ? (thanksPlanForLibrary(image.src) ?? {
            fit: "cover",
            aspectRatio: "3 / 2",
            objectPosition: "center",
          })
        : hostPlan;

  useEffect(() => {
    if (!thanks || image.kind !== "host" || cutout) {
      return;
    }
    const img = photoRef.current;
    if (!img) {
      return;
    }
    const read = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (width <= 0 || height <= 0) {
        return;
      }
      const next = thanksPlanForMeasurement(width, height, image.src);
      setMeasured((current) => {
        if (
          current?.src === image.src &&
          current.plan.fit === next.fit &&
          current.plan.aspectRatio === next.aspectRatio &&
          current.plan.objectPosition === next.objectPosition
        ) {
          return current;
        }
        return { src: image.src, plan: next };
      });
    };
    img.addEventListener("load", read);
    if (img.complete) {
      read();
    }
    return () => img.removeEventListener("load", read);
  }, [cutout, image.kind, image.src, thanks]);

  if (!image.src || image.kind === "illustration") {
    return null;
  }

  const photo = (
    <img
      ref={photoRef}
      src={image.src}
      alt={decorative ? "" : image.alt}
      data-image-source={image.kind}
      data-journey-photo=""
      data-gift-photo={gift ? "" : undefined}
      decoding="async"
      style={plan ? { objectPosition: plan.objectPosition } : undefined}
    />
  );

  return (
    <div
      data-journey-frame=""
      data-fit={thanks ? (plan?.fit ?? "pending") : giftPhotoFit(image.src)}
      style={plan ? { aspectRatio: plan.aspectRatio } : undefined}
    >
      {plan?.fit === "mat" ? (
        <img src={image.src} alt="" aria-hidden="true" data-journey-backdrop="" decoding="async" />
      ) : null}
      {image.avif && plan?.fit !== "mat" ? (
        <picture>
          <source srcSet={image.avif} type="image/avif" />
          {photo}
        </picture>
      ) : (
        photo
      )}
      {image.illustrative ? <span data-illustrative-label="">{ILLUSTRATIVE_LABEL}</span> : null}
    </div>
  );
}
