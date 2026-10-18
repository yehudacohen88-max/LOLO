import BrandMark from "@/components/brand-mark";
import StepMark from "@/components/step-mark";

type PageHeaderProps = {
  title?: string;
  subtitle?: string;
  step?: number;
  total?: number;
  label?: string;
  notice?: string;
};

export default function PageHeader({
  title,
  subtitle,
  step,
  total,
  label,
  notice,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col items-center text-center">
      <BrandMark />
      <StepMark step={step} total={total} label={label} />
      {title ? <h1 className="lolo-title mt-5">{title}</h1> : null}
      {notice ? <p className="lolo-demo mt-4">{notice}</p> : null}
      {subtitle ? (
        <p className="mt-3 max-w-md text-base leading-relaxed text-muted sm:text-lg">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
