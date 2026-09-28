const KEY = "lolo-host-access-code";

function scopedKey(slug: string) {
  return `${KEY}:${slug}`;
}

export function saveCreatedHostAccessCode(slug: string, accessCode: string) {
  if (typeof window === "undefined" || !slug || !accessCode) {
    return;
  }
  window.sessionStorage.setItem(scopedKey(slug), accessCode);
}

export function loadCreatedHostAccessCode(slug: string) {
  if (typeof window === "undefined" || !slug) {
    return "";
  }
  return window.sessionStorage.getItem(scopedKey(slug)) ?? "";
}
