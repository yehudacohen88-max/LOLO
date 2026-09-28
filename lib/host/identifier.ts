import { normalizeEventSlug } from "@/lib/events/slug";

export function slugFromHostIdentifier(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const eventIndex = parts.indexOf("e");
    if (eventIndex >= 0 && parts[eventIndex + 1]) {
      return normalizeEventSlug(parts[eventIndex + 1]);
    }
  } catch {
    // Not a URL; treat as a slug.
  }

  return normalizeEventSlug(trimmed.replace(/^\/e\//, ""));
}
