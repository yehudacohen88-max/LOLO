import Link from "next/link";

type BrandMarkProps = {
  href?: string;
  as?: "link" | "text";
  className?: string;
};

export default function BrandMark({
  href = "/",
  as = "link",
  className = "",
}: BrandMarkProps) {
  const classes = `lolo-mark ${className}`.trim();
  if (as === "text") {
    return <span className={classes}>LOLO</span>;
  }
  return (
    <Link href={href} className={classes}>
      LOLO
    </Link>
  );
}
