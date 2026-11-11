/** Presentation-only motifs for the guest event page. */

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
  /* משחקים ends in ים. That plural ending is not a travel word. */
  if (/קונסול|משחקים|פלייסטיישן|נינטנדו|אקסבוקס/.test(title)) {
    return "gift";
  }
  if (/חופשה|טיול|טיסה|מלון|מזווד|נופש|סופ["״']ש/.test(title)) {
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
