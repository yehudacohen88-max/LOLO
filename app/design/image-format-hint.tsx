import type { ReactNode } from "react";

/** Keeps the Latin format list and the size on one unit so `5MB.` cannot wrap alone. */
export default function ImageFormatHint({ lead }: { lead: ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-muted">
      {lead}{" "}
      <bdi dir="ltr">JPG, PNG, WEBP</bdi>{" "}
      <span className="whitespace-nowrap">
        עד <bdi dir="ltr">5MB.</bdi>
      </span>
    </p>
  );
}
