export type EventGuest = {
  id: string;
  eventId: string;
  name: string;
  phone: string;
  createdAt: string;
  invitePath?: string;
};

export function normalizeGuestName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeGuestPhone(value: string) {
  const trimmed = value.trim();
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return plus ? `+${digits}` : digits;
}

export function isValidGuestPhone(phone: string) {
  const digits = normalizeGuestPhone(phone).replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

export function parseGuestInput(input: { name?: string; phone?: string }) {
  const name = normalizeGuestName(input.name ?? "");
  const phone = normalizeGuestPhone(input.phone ?? "");

  if (!name) {
    throw new Error("נא להזין שם אורח.");
  }
  if (!isValidGuestPhone(phone)) {
    throw new Error("נא להזין מספר טלפון תקין.");
  }

  return { name, phone };
}

export function parseGuestList(value: unknown) {
  if (value == null) {
    return [] as { name: string; phone: string }[];
  }
  if (!Array.isArray(value)) {
    throw new Error("רשימת האורחים אינה תקינה.");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`אורח מספר ${index + 1} אינו תקין.`);
    }
    const row = item as { name?: string; phone?: string };
    try {
      return parseGuestInput(row);
    } catch {
      throw new Error(`אורח מספר ${index + 1}: נא להזין שם ומספר טלפון תקינים.`);
    }
  });
}
