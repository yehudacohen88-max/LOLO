"use client";

/* Host uploads are remote URLs. next/image remote patterns cannot cover them. */
/* eslint-disable @next/next/no-img-element */

import { useState, type ReactNode } from "react";
import { ILLUSTRATIVE_LABEL, type ResolvedImage } from "@/lib/image-library";
import styles from "./bold-create.module.css";

type ResolvedPhotoProps = {
  visual: ResolvedImage;
  backup?: ResolvedImage | null;
  ratio?: "cover" | "card";
  compact?: boolean;
  className?: string;
  fallback?: ReactNode;
};

export default function ResolvedPhoto(props: ResolvedPhotoProps) {
  const identity = `${props.visual.src}|${props.backup?.src ?? ""}|${props.visual.kind}`;
  return <ResolvedPhotoFrame key={identity} {...props} />;
}

function ResolvedPhotoFrame({
  visual,
  backup = null,
  ratio = "cover",
  compact = false,
  className,
  fallback = null,
}: ResolvedPhotoProps) {
  const [level, setLevel] = useState(0);
  const options = [visual, backup].filter(
    (item): item is ResolvedImage => Boolean(item?.src) && item?.kind !== "illustration",
  );
  const shown = options[level];

  if (!shown) {
    return <>{fallback}</>;
  }

  const image = (
    <img
      src={shown.src}
      alt={shown.alt}
      width={ratio === "card" ? 1100 : 1600}
      height={ratio === "card" ? 733 : 1200}
      data-image-source={shown.kind}
      decoding="async"
      onError={() => setLevel((current) => current + 1)}
    />
  );

  return (
    <figure
      className={`${styles.frame} ${compact ? styles.frameCompact : ""} ${className ?? ""}`}
      data-ratio={compact ? undefined : ratio}
      data-resolved-photo={shown.kind}
    >
      {shown.avif ? (
        <picture>
          <source srcSet={shown.avif} type="image/avif" />
          {image}
        </picture>
      ) : (
        image
      )}
      {shown.illustrative ? <span data-illustrative-label="">{ILLUSTRATIVE_LABEL}</span> : null}
    </figure>
  );
}
