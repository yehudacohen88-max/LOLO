type GiftMediaProps = {
  imageUrl?: string;
  icon?: string;
  alt?: string;
  className?: string;
  flush?: boolean;
};

export default function GiftMedia({
  imageUrl,
  icon,
  alt = "",
  className = "h-20 w-20 text-3xl",
  flush = false,
}: GiftMediaProps) {
  const radius = flush ? "" : "rounded-2xl";

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={alt}
        className={`block shrink-0 object-cover ${radius} ${className}`}
      />
    );
  }

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-[#f6e6de] text-foreground ${radius} ${className}`}
      aria-hidden
    >
      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 bg-[#c4a574]/70" />
      <span className="pointer-events-none absolute left-[12%] right-[12%] top-1/2 h-3 -translate-y-1/2 bg-[#c4a574]/70" />
      <span className="relative drop-shadow-sm">{icon || "🎁"}</span>
    </span>
  );
}