import type { EventGift, StoredEvent } from "./types";

export const DEMO_EVENT_SLUG = "demo-event";

/** Visible label for every invented figure on the bundled showcase. */
export const DEMO_SAMPLE_BADGE = "אירוע הדגמה — נתונים לדוגמה";

/** The photos are the e2e fixtures. Pexels License allows commercial use. */
export const DEMO_IMAGE_CREDIT =
  "תמונות: Pexels License, שימוש מסחרי מותר. המקור הוא תמונות ההדגמה שבבדיקות הממשק.";

/**
 * Sample progress for the showcase only. The funding API still calculates
 * this event from an empty order list, so the page labels these figures.
 * 3,600 / 4,800 = 75%.
 */
export const DEMO_SAMPLE_FUNDING = {
  giftId: "demo-espresso",
  raisedAmount: 3600,
  contributorCount: 18,
  percentOfTarget: 75,
} as const;

export function buildDemoEvent(): StoredEvent {
  const id = "demo-event-id";
  const gifts: EventGift[] = [
    {
      id: DEMO_SAMPLE_FUNDING.giftId,
      eventId: id,
      title: "מכונת אספרסו פרימיום",
      description: "מכונה לבית, מתנה מכל החברים.",
      targetAmount: 4800,
      icon: "",
      imageUrl: "/demo/espresso.png",
      source: "custom",
      priority: 0,
      active: true,
      storeId: null,
      storeName: "",
    },
  ];

  return {
    id,
    slug: DEMO_EVENT_SLUG,
    title: "חוגגים 40 לדנה — מתנה מכל החברים",
    hostName: "נועה",
    eventType: "יום הולדת",
    date: "",
    time: "",
    venueName: "",
    address: "",
    message: "השנה החלטנו להפתיע את דנה במשהו שהיא באמת חולמת עליו.",
    coverImage: "/demo/celebrant.jpg",
    giftMode: "catalog",
    moneyAmounts: [200, 350, 500],
    allowCustomAmount: true,
    moneyDisplay: "amounts",
    gifts,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}
