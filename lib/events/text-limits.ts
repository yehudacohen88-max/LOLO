export const EVENT_FIELD_LIMITS = {
  title: 120,
  message: 500,
  venueName: 120,
  address: 200,
} as const;

export const EVENT_FIELD_ERRORS = {
  title: `שם האירוע יכול להכיל עד ${EVENT_FIELD_LIMITS.title} תווים.`,
  message: `ההודעה לאורחים יכולה להכיל עד ${EVENT_FIELD_LIMITS.message} תווים.`,
  venueName: `שם המקום יכול להכיל עד ${EVENT_FIELD_LIMITS.venueName} תווים.`,
  address: `הכתובת יכולה להכיל עד ${EVENT_FIELD_LIMITS.address} תווים.`,
} as const;

export function capEventText(value: unknown, max: number) {
  return (typeof value === "string" ? value : "").trim().slice(0, max);
}
