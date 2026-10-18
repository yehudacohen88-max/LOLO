import BrandMark from "@/components/brand-mark";

export default function RouteLoading({ label = "טוענים..." }: { label?: string }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-5 py-16 text-center">
      <BrandMark as="text" />
      <p className="mt-8 text-base text-muted" role="status">
        {label}
      </p>
    </main>
  );
}
