export function slugifyTitle(title: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return base || "event";
}

export function randomSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

export function normalizeEventSlug(slug: string) {
  if (!slug) {
    return "";
  }

  let current = slug.trim();
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(current.replace(/\+/g, "%20"));
      if (decoded === current) {
        break;
      }
      current = decoded;
    } catch {
      break;
    }
  }

  return current.normalize("NFC");
}

export function fromRouteParam(slug: string | string[] | undefined) {
  const raw = Array.isArray(slug) ? slug[0] : slug;
  return normalizeEventSlug(raw ?? "");
}

export function slugsMatch(stored: string, incoming: string) {
  const a = normalizeEventSlug(stored);
  const b = normalizeEventSlug(incoming);
  return (
    a === b ||
    stored === incoming ||
    encodeURIComponent(a) === incoming ||
    encodeURIComponent(stored) === incoming
  );
}

export function createUniqueSlug(title: string, existing: string[]) {
  const taken = new Set(existing.map(normalizeEventSlug));
  let slug = `${slugifyTitle(title)}-${randomSuffix()}`;

  while (taken.has(slug)) {
    slug = `${slugifyTitle(title)}-${randomSuffix()}`;
  }

  return slug;
}
