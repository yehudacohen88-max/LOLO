import Link from "next/link";
import BrandMark from "@/components/brand-mark";

type FriendlyStatusProps = {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
};

export default function FriendlyStatus({
  title,
  body,
  actionHref = "/",
  actionLabel = "חזרה לדף הבית",
}: FriendlyStatusProps) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-5 py-16 text-center sm:py-24">
      <BrandMark as="text" />
      <h1 className="lolo-title mt-8">
        {title}
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted">{body}</p>
      <Link
        href={actionHref}
        className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover"
      >
        {actionLabel}
      </Link>
    </main>
  );
}
