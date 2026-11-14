export const CREATE_STEP_COUNT = 5;

export const CREATE_STEPS = [
  { step: 1, label: "האירוע", href: "/create-event" },
  { step: 2, label: "מתנות", href: "/create-event/gifts" },
  { step: 3, label: "פרטים", href: "/create-event/details" },
  { step: 4, label: "אורחים", href: "/create-event/guests" },
  { step: 5, label: "תצוגה", href: "/create-event/preview" },
] as const;

export function createStepLabel(step: number) {
  return `שלב ${step} מתוך ${CREATE_STEP_COUNT}`;
}
