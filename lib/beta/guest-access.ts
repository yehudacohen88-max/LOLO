import { canonicalEventSlug } from "@/lib/events/slug";

/**
 * Exact guest paths that skip the beta password.
 * Lookup of an existing slug is unchanged; this only decides who may request it.
 */

const SLUG = "[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?";

export const EVENT_SLUG_PATTERN = new RegExp(`^${SLUG}$`);

/**
 * One path segment, including mixed case and malformed shapes.
 * The handler returns the same not-found response as a missing event.
 * Traversal is rejected earlier in isGuestDirectAccess.
 */
const EVENT_SEGMENT = "[^/]{1,80}";
const INVITE_SEGMENT = "[^/]{1,256}";
const EVENT_PAGE = new RegExp(
  `^/e/${EVENT_SEGMENT}(?:/(?:greeting|details|payment|thank-you))?/?$`,
  "i",
);
const EVENT_API = new RegExp(`^/api/events/${EVENT_SEGMENT}$`, "i");
const FUNDING_API = new RegExp(`^/api/events/${EVENT_SEGMENT}/funding$`, "i");
const INVITE_PAGE = new RegExp(`^/i/${INVITE_SEGMENT}/?$`);

const PAGE_METHODS = new Set(["GET", "HEAD"]);

export function isPublicEventSlug(slug: string) {
  return EVENT_SLUG_PATTERN.test(canonicalEventSlug(slug));
}

function decodedGuestPath(pathname: string) {
  let current = pathname;
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) {
        break;
      }
      current = decoded;
    } catch {
      return pathname;
    }
  }
  return current;
}

export function isGuestDirectAccess(pathname: string, method: string) {
  const decoded = decodedGuestPath(pathname);
  if (
    !pathname ||
    pathname.length > 512 ||
    decoded.length > 512 ||
    pathname.includes("\\") ||
    decoded.includes("\\") ||
    pathname.includes("\0") ||
    decoded.includes("\0") ||
    pathname.includes("..") ||
    decoded.includes("..") ||
    pathname.includes("//") ||
    decoded.includes("//")
  ) {
    return false;
  }

  pathname = decoded;

  const verb = method.toUpperCase();

  if (EVENT_PAGE.test(pathname) || INVITE_PAGE.test(pathname)) {
    return PAGE_METHODS.has(verb);
  }
  if (EVENT_API.test(pathname) || FUNDING_API.test(pathname)) {
    return verb === "GET";
  }
  if (pathname === "/api/orders") {
    return verb === "GET" || verb === "POST";
  }
  if (pathname === "/api/checkout/quote") {
    return verb === "POST";
  }
  if (pathname === "/api/payments/start" || pathname === "/api/payments/confirm") {
    return verb === "POST";
  }
  if (pathname === "/api/invite/identity") {
    return verb === "GET";
  }
  return false;
}
