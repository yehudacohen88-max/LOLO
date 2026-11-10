/** Presentation-only. Stage A themes for the main guest event page. */

export type CelebrationLook = "bold" | "elegant";

export type OccasionMotif =
  | "birthday"
  | "wedding"
  | "henna"
  | "mitzvah"
  | "brit"
  | "halake"
  | "party";

export type GiftMotif =
  | "coffee"
  | "travel"
  | "cake"
  | "flowers"
  | "book"
  | "gift"
  | "balloons";

export type ArtKind = OccasionMotif | GiftMotif;

export function parseCelebrationLook(
  value: string | string[] | undefined | null,
): CelebrationLook | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "bold" || raw === "elegant") {
    return raw;
  }
  return null;
}

export function occasionMotif(eventType: string): OccasionMotif {
  const type = eventType.trim();
  if (type.includes("הולדת")) {
    return "birthday";
  }
  if (type.includes("חתונה")) {
    return "wedding";
  }
  if (type.includes("חינה")) {
    return "henna";
  }
  if (type.includes("מצווה")) {
    return "mitzvah";
  }
  if (type.includes("ברית")) {
    return "brit";
  }
  if (type.includes("חלאקה")) {
    return "halake";
  }
  return "party";
}

export function giftMotif(title: string, index: number): GiftMotif {
  if (/קפה|אספרסו/.test(title)) {
    return "coffee";
  }
  if (/חופשה|טיול|טיסה|מלון|זוגית|ים/.test(title)) {
    return "travel";
  }
  if (/עוגה|מתוק|קינוח/.test(title)) {
    return "cake";
  }
  if (/פרח|זר/.test(title)) {
    return "flowers";
  }
  if (/ספר/.test(title)) {
    return "book";
  }
  return index % 2 === 0 ? "gift" : "balloons";
}
