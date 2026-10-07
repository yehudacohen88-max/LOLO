type GiftTimelineProps = {
  paid: boolean;
  issued: boolean;
  redeemed: "none" | "partial" | "full";
};

const STEPS = [
  { key: "paid", label: "נאסף כסף" },
  { key: "issued", label: "שובר הונפק" },
  { key: "redeemed", label: "מומש בחנות" },
] as const;

function stepState(key: (typeof STEPS)[number]["key"], props: GiftTimelineProps) {
  if (key === "paid") {
    return props.paid ? "done" : "current";
  }
  if (key === "issued") {
    if (props.issued) {
      return "done";
    }
    return props.paid ? "current" : "upcoming";
  }
  if (props.redeemed === "full") {
    return "done";
  }
  if (props.redeemed === "partial" || props.issued) {
    return "current";
  }
  return "upcoming";
}

export default function GiftTimeline(props: GiftTimelineProps) {
  return (
    <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="מסלול המתנה">
      {STEPS.map((step, index) => {
        const state = stepState(step.key, props);
        const label =
          step.key === "redeemed" && props.redeemed === "partial"
            ? "מומש חלקית"
            : step.label;
        const circle =
          state === "done"
            ? "bg-brand text-white"
            : state === "current"
              ? "bg-white text-brand ring-2 ring-brand"
              : "bg-border text-muted";
        return (
          <li key={step.key} className="flex flex-col items-center text-center">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${circle}`}
              aria-hidden
            >
              {(index + 1).toLocaleString("he-IL")}
            </span>
            <span
              className={`mt-2 text-xs font-semibold leading-snug ${
                state === "upcoming" ? "text-muted" : "text-foreground"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
