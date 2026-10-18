type StepMarkProps = {
  step?: number;
  total?: number;
  label?: string;
};

export default function StepMark({ step, total, label }: StepMarkProps) {
  const text = label ?? (step && total ? `שלב ${step} מתוך ${total}` : "");
  if (!text) {
    return null;
  }

  return (
    <div className="mt-6 flex w-full max-w-xs flex-col items-center gap-2">
      <p className="text-sm font-semibold text-brand">{text}</p>
      {step && total ? (
        <ol className="flex w-full gap-1.5" aria-hidden>
          {Array.from({ length: total }, (_, index) => (
            <li
              key={index}
              className={`h-1.5 flex-1 rounded-full ${
                index < step ? "bg-brand" : "bg-border"
              }`}
            />
          ))}
        </ol>
      ) : null}
    </div>
  );
}
