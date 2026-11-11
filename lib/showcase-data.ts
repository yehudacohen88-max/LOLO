import type { EventGift, StoredEvent } from "./events/types";
import { libraryBySlug } from "./image-library";

/**
 * Static scenes for /showcase. Not stored, not fetched, and not an order.
 */

export const SHOWCASE_SCENES = ["birthday", "wedding", "plain"] as const;

export type ShowcaseScene = (typeof SHOWCASE_SCENES)[number];

export const SHOWCASE_LABELS: Record<ShowcaseScene, string> = {
  birthday: "יום הולדת",
  wedding: "חתונה",
  plain: "בלי תמונות מהמארח",
};

type FundingRow = {
  raisedAmount: number;
  contributorCount: number;
  percentOfTarget: number | null;
};

export type ShowcasePreview = {
  event: StoredEvent;
  funding: Record<string, FundingRow>;
};

function gift(
  eventId: string,
  id: string,
  title: string,
  description: string,
  targetAmount: number,
  priority: number,
  imageUrl = "",
): EventGift {
  return {
    id,
    eventId,
    title,
    description,
    targetAmount,
    icon: "",
    imageUrl,
    source: "custom",
    priority,
    active: true,
    storeId: null,
    storeName: "",
  };
}

const birthdayId = "showcase-birthday";
const weddingId = "showcase-wedding";
const plainId = "showcase-plain";

const birthday: StoredEvent = {
  id: birthdayId,
  slug: "showcase-birthday",
  title: "יום הולדת 30 למיכל",
  hostName: "יעל אברהם",
  eventType: "יום הולדת",
  date: "2026-12-04",
  time: "20:00",
  venueName: "הבית של יעל",
  address: "ירמיהו 18, תל אביב",
  message: "מיכל ביקשה השנה מתנה אחת גדולה, מכולנו יחד.",
  coverImage: libraryBySlug("candle-layer-cake", "hero").file,
  giftMode: "catalog",
  moneyAmounts: [150, 250, 350, 500],
  allowCustomAmount: true,
  moneyDisplay: "amounts",
  gifts: [
    gift(
      birthdayId,
      "showcase-trip",
      "חופשה זוגית",
      "סוף שבוע לשניים.",
      3200,
      0,
      libraryBySlug("tropical-beach", "card").file,
    ),
    gift(
      birthdayId,
      "showcase-coffee",
      "מכונת קפה",
      "לבית החדש. אפשר להשתתף בכל סכום.",
      1800,
      1,
      libraryBySlug("red-cups", "card").file,
    ),
    gift(
      birthdayId,
      "showcase-flowers",
      "זר פרחים",
      "זר עונתי בגוונים חמים.",
      450,
      2,
      libraryBySlug("peach-box", "card").file,
    ),
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
};

const wedding: StoredEvent = {
  id: weddingId,
  slug: "showcase-wedding",
  title: "החתונה של דנה ואורי",
  hostName: "משפחת לוי",
  eventType: "חתונה",
  date: "2026-06-18",
  time: "19:30",
  venueName: "גן אירועים",
  address: "הירקון 12, תל אביב",
  message: "נשמח שתחלקו איתנו את הערב, ואת המתנה שתבחרו.",
  coverImage: "",
  giftMode: "catalog",
  moneyAmounts: [200, 350, 500],
  allowCustomAmount: true,
  moneyDisplay: "amounts",
  gifts: [
    gift(weddingId, "showcase-rings", "טבעות נישואין", "זוג טבעות ליום הגדול.", 2400, 0),
    gift(weddingId, "showcase-bouquet", "זר כלה", "פרחים עונתיים בגוון חם.", 800, 1),
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
};

const plain: StoredEvent = {
  id: plainId,
  slug: "showcase-plain",
  title: "יום הולדת חדש",
  hostName: "נועה לוי",
  eventType: "יום הולדת",
  date: "2026-11-20",
  time: "18:00",
  venueName: "",
  address: "",
  message: "עדיין אין תמונות שהמארח העלה. העמוד משתמש בברירת המחדל של LOLO.",
  coverImage: "",
  giftMode: "catalog",
  moneyAmounts: [150, 250, 350, 500],
  allowCustomAmount: true,
  moneyDisplay: "amounts",
  gifts: [
    gift(plainId, "plain-coffee", "מכונת אספרסו", "מכונה לבית, להמחשה בלבד.", 2500, 0),
    gift(plainId, "plain-trip", "חופשה זוגית", "סוף שבוע מחוץ לעיר.", 4000, 1),
    gift(plainId, "plain-flowers", "זר פרחים", "זר צבעוני.", 350, 2),
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const SHOWCASE_PREVIEWS: Record<ShowcaseScene, ShowcasePreview> = {
  birthday: {
    event: birthday,
    funding: {
      "showcase-coffee": { raisedAmount: 720, contributorCount: 6, percentOfTarget: 40 },
      "showcase-trip": { raisedAmount: 2100, contributorCount: 16, percentOfTarget: 65.6 },
      "showcase-flowers": { raisedAmount: 180, contributorCount: 4, percentOfTarget: 40 },
    },
  },
  wedding: {
    event: wedding,
    funding: {
      "showcase-rings": { raisedAmount: 900, contributorCount: 7, percentOfTarget: 37.5 },
      "showcase-bouquet": { raisedAmount: 200, contributorCount: 3, percentOfTarget: 25 },
    },
  },
  plain: {
    event: plain,
    funding: {
      "plain-coffee": { raisedAmount: 400, contributorCount: 3, percentOfTarget: 16 },
      "plain-trip": { raisedAmount: 0, contributorCount: 0, percentOfTarget: 0 },
      "plain-flowers": { raisedAmount: 150, contributorCount: 2, percentOfTarget: 42.9 },
    },
  },
};

export function isShowcaseScene(value: string | null): value is ShowcaseScene {
  return SHOWCASE_SCENES.some((scene) => scene === value);
}
