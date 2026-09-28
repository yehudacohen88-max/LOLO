const ORDER_KEY = "lolo-guest-order";

export type GuestOrderRef = {
  id: string;
  accessToken: string;
};

function scopedKey(slug: string) {
  return `${ORDER_KEY}:${slug}`;
}

export function loadGuestOrderRef(slug: string): GuestOrderRef | null {
  if (typeof window === "undefined" || !slug) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(scopedKey(slug));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<GuestOrderRef>;
    if (
      typeof parsed.id === "string" &&
      parsed.id &&
      typeof parsed.accessToken === "string" &&
      parsed.accessToken
    ) {
      return { id: parsed.id, accessToken: parsed.accessToken };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveGuestOrderRef(slug: string, ref: GuestOrderRef) {
  window.localStorage.setItem(scopedKey(slug), JSON.stringify(ref));
}
