import { isPublicEventSlug } from "@/lib/beta/guest-access";
import { canonicalEventSlug } from "@/lib/events/slug";
export const GUEST_TEXT_LIMITS = {
  name: 80,
  phone: 32,
  email: 120,
  greeting: 500,
} as const;

export const GUEST_MONEY_LIMITS = {
  items: 8,
  giftId: 80,
  amount: 100_000,
  total: 100_000,
} as const;

export const GUEST_BODY_BYTES = {
  order: 12_000,
  payment: 4_000,
  quote: 8_000,
} as const;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID.test(value);
}

export function publicSlugOrNull(slug: string) {
  const decoded = canonicalEventSlug(slug);
  if (!isPublicEventSlug(decoded)) {
    return null;
  }
  return decoded;
}

export function guestItemsProblem(items: unknown) {
  if (!Array.isArray(items)) {
    return "הבקשה אינה תקינה.";
  }
  if (items.length > GUEST_MONEY_LIMITS.items) {
    return "אפשר לבחור עד 8 מתנות.";
  }

  let total = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") {
      return "הבקשה אינה תקינה.";
    }
    const row = item as { giftId?: unknown; amount?: unknown };
    if (typeof row.giftId !== "string" || row.giftId.length > GUEST_MONEY_LIMITS.giftId) {
      return "הבקשה אינה תקינה.";
    }
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return "הסכום אינו תקין.";
    }
    if (amount > GUEST_MONEY_LIMITS.amount) {
      return "הסכום גבוה מהמותר.";
    }
    total += amount;
  }
  if (total > GUEST_MONEY_LIMITS.total) {
    return "הסכום גבוה מהמותר.";
  }
  return null;
}

export function guestTextProblem(input: {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  greetingText: string;
}) {
  if (input.guestName.trim().length > GUEST_TEXT_LIMITS.name) {
    return "השם יכול להכיל עד 80 תווים.";
  }
  if (input.guestPhone.trim().length > GUEST_TEXT_LIMITS.phone) {
    return "מספר הטלפון ארוך מדי.";
  }
  if (input.guestEmail.trim().length > GUEST_TEXT_LIMITS.email) {
    return "האימייל ארוך מדי.";
  }
  if (input.greetingText.trim().length > GUEST_TEXT_LIMITS.greeting) {
    return "הברכה יכולה להכיל עד 500 תווים.";
  }
  return null;
}
