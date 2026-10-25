/**
 * Client IP for guest rate limits.
 *
 * Do not read the leftmost value of `x-forwarded-for`. A caller can prepend
 * any address there, so each spoofed value looks like a new client and the
 * limit never trips. Vercel overwrites `x-vercel-forwarded-for` and
 * `x-real-ip` with the address it actually saw, so those two are the only
 * headers this helper trusts. If neither is present the caller shares the
 * bucket "unknown" rather than a client-chosen address.
 */
const MAX_IP_LENGTH = 128;

type HeaderStore = { get(name: string): string | null };

function firstAddress(value: string | null) {
  const address = value?.split(",")[0]?.trim() ?? "";
  if (!address || address.length > MAX_IP_LENGTH) {
    return "";
  }
  return address;
}

export function clientIpFromVercelHeaders(headerStore: HeaderStore) {
  const vercelForwarded = firstAddress(headerStore.get("x-vercel-forwarded-for"));
  if (vercelForwarded) {
    return vercelForwarded;
  }
  const realIp = firstAddress(headerStore.get("x-real-ip"));
  if (realIp) {
    return realIp;
  }
  return "unknown";
}
