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
