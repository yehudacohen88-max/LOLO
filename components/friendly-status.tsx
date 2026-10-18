import Link from "next/link";

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
      <p className="text-4xl font-extrabold tracking-[0.28em] text-brand">LOLO</p>
      <h1 className="mt-8 text-2xl font-bold leading-tight text-foreground sm:text-4xl">
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
