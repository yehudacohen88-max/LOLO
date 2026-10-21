/**
 * Exact guest paths that skip the beta password.
 * Lookup of an existing slug is unchanged; this only decides who may request it.
 */

const SLUG = "[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?";

export const EVENT_SLUG_PATTERN = new RegExp(`^${SLUG}$`);

const EVENT_PAGE = new RegExp(
  `^/e/${SLUG}(?:/(?:greeting|details|payment|thank-you))?/?$`,
);
const EVENT_API = new RegExp(`^/api/events/${SLUG}$`);
const FUNDING_API = new RegExp(`^/api/events/${SLUG}/funding$`);
const INVITE_PAGE = /^\/i\/[A-Za-z0-9_-]{22,128}\/?$/;

const PAGE_METHODS = new Set(["GET", "HEAD"]);

export function isPublicEventSlug(slug: string) {
  return EVENT_SLUG_PATTERN.test(slug);
}

export function isGuestDirectAccess(pathname: string, method: string) {
  if (
    !pathname ||
    pathname.length > 512 ||
    pathname.includes("\\") ||
    pathname.includes("\0") ||
    pathname.includes("%") ||
    pathname.includes("..") ||
    pathname.includes("//")
  ) {
    return false;
  }

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
