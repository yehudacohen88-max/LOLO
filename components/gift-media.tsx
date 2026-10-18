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
      <span className="lolo-corner-ribbon" />
      <span className="relative">{icon || "🎁"}</span>
    </span>
  );
}