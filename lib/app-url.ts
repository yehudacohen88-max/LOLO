export function originFromProxyHeaders(headerStore: { get(name: string): string | null }) {
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const protocol =
    headerStore.get("x-forwarded-proto") ||
    (host.startsWith("localhost") ? "http" : "https");
  if (!host) {
    return "";
  }
  return `${protocol}://${host}`;
}

export function appPublicOrigin(fallbackOrigin = "") {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (configured) {
    return configured;
  }
  return fallbackOrigin.trim().replace(/\/+$/, "");
}

export function absoluteAppUrl(path: string, fallbackOrigin = "") {
  if (!path) {
    return "";
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const origin = appPublicOrigin(fallbackOrigin);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${normalized}` : normalized;
}
