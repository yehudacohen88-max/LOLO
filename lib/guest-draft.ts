export type GuestContribution = {
  giftId: string;
  giftName: string;
  amount: number;
};

export type GuestGiftChoice = {
  amount: number;
  contributions: GuestContribution[];
};

export type GuestGreeting = {
  text: string;
  imageDataUrl: string;
  audioDataUrl: string;
  audioName: string;
  videoDataUrl: string;
  videoName: string;
};

export type GuestDetails = {
  name: string;
  phone: string;
  email: string;
  wantReceipt: boolean;
};

const GUEST_AMOUNT_KEY = "lolo-guest-amount";
const GUEST_GREETING_KEY = "lolo-guest-greeting";
const GUEST_DETAILS_KEY = "lolo-guest-details";

function scopedKey(base: string, slug: string) {
  return `${base}:${slug}`;
}

function readScopedJson<T>(base: string, slug: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const scoped = window.localStorage.getItem(scopedKey(base, slug));
    if (scoped) {
      return { ...fallback, ...(JSON.parse(scoped) as Partial<T>) };
    }

    if (slug === "demo-event") {
      const legacy = window.localStorage.getItem(base);
      if (legacy) {
        return { ...fallback, ...(JSON.parse(legacy) as Partial<T>) };
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

const emptyGreeting: GuestGreeting = {
  text: "",
  imageDataUrl: "",
  audioDataUrl: "",
  audioName: "",
  videoDataUrl: "",
  videoName: "",
};
const emptyDetails: GuestDetails = {
  name: "",
  phone: "",
  email: "",
  wantReceipt: true,
};

function parseContributions(raw: unknown): GuestContribution[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const parsed = raw as Partial<GuestGiftChoice> & {
    amount?: number;
    contributions?: unknown;
  };

  if (Array.isArray(parsed.contributions)) {
    return parsed.contributions.filter(
      (item): item is GuestContribution =>
        Boolean(item) &&
        typeof item.giftId === "string" &&
        typeof item.giftName === "string" &&
        typeof item.amount === "number" &&
        Number.isFinite(item.amount) &&
        item.amount > 0,
    );
  }

  if (typeof parsed.amount === "number" && parsed.amount > 0) {
    return [
      {
        giftId: "event-money",
        giftName: "מתנה לאירוע",
        amount: parsed.amount,
      },
    ];
  }

  return [];
}

function readContributionPayload(slug: string): unknown {
  if (typeof window === "undefined") {
    return null;
  }

  const scoped = window.localStorage.getItem(scopedKey(GUEST_AMOUNT_KEY, slug));
  if (scoped) {
    return JSON.parse(scoped);
  }

  if (slug === "demo-event") {
    const legacy = window.localStorage.getItem(GUEST_AMOUNT_KEY);
    if (legacy) {
      return JSON.parse(legacy);
    }
  }

  return null;
}

export function loadContributions(slug: string): GuestContribution[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return parseContributions(readContributionPayload(slug));
  } catch {
    return [];
  }
}

export function getContributionsTotal(contributions: GuestContribution[]) {
  return contributions.reduce((sum, item) => sum + item.amount, 0);
}

export function saveContributions(
  slug: string,
  contributions: GuestContribution[],
) {
  const clean = contributions.filter((item) => item.amount > 0);
  window.localStorage.setItem(
    scopedKey(GUEST_AMOUNT_KEY, slug),
    JSON.stringify({
      contributions: clean,
      amount: getContributionsTotal(clean),
    } satisfies GuestGiftChoice),
  );
}

export function loadGuestGiftChoice(slug: string): GuestGiftChoice {
  const contributions = loadContributions(slug);
  return {
    contributions,
    amount: getContributionsTotal(contributions),
  };
}

export function loadGuestGreeting(slug: string): GuestGreeting {
  const parsed = readScopedJson(GUEST_GREETING_KEY, slug, emptyGreeting);
  return {
    text: typeof parsed.text === "string" ? parsed.text : "",
    imageDataUrl:
      typeof parsed.imageDataUrl === "string" ? parsed.imageDataUrl : "",
    audioDataUrl:
      typeof parsed.audioDataUrl === "string" ? parsed.audioDataUrl : "",
    audioName: typeof parsed.audioName === "string" ? parsed.audioName : "",
    videoDataUrl:
      typeof parsed.videoDataUrl === "string" ? parsed.videoDataUrl : "",
    videoName: typeof parsed.videoName === "string" ? parsed.videoName : "",
  };
}

export function saveGuestGreeting(slug: string, greeting: GuestGreeting) {
  const payload = { ...emptyGreeting, ...greeting };
  const key = scopedKey(GUEST_GREETING_KEY, slug);
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...payload,
        imageDataUrl: payload.imageDataUrl ? "[saved]" : "",
        audioDataUrl: "",
        videoDataUrl: "",
      }),
    );
  }
}

export function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function loadGuestDetails(slug: string): GuestDetails {
  const parsed = readScopedJson(GUEST_DETAILS_KEY, slug, emptyDetails);
  return {
    name: typeof parsed.name === "string" ? parsed.name : "",
    phone: typeof parsed.phone === "string" ? parsed.phone : "",
    email: typeof parsed.email === "string" ? parsed.email : "",
    wantReceipt: parsed.wantReceipt !== false,
  };
}

export function saveGuestDetails(slug: string, details: GuestDetails) {
  window.localStorage.setItem(
    scopedKey(GUEST_DETAILS_KEY, slug),
    JSON.stringify(details),
  );
}

export function formatGiftAmount(amount: number) {
  return `${amount.toLocaleString("he-IL")} ₪`;
}
