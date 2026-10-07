type GiftMediaProps = {
  imageUrl?: string;
  icon?: string;
  alt?: string;
  className?: string;
};

export default function GiftMedia({
  imageUrl,
  icon,
  alt = "",
  className = "h-20 w-20 text-3xl",
}: GiftMediaProps) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={alt}
        className={`block shrink-0 rounded-2xl object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-brand-soft ${className}`}
      aria-hidden
    >
      {icon || "🎁"}
    </span>
  );
}
