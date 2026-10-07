import type { EventGift, StoredEvent } from "./types";

export const DEMO_EVENT_SLUG = "demo-event";

export function buildDemoEvent(): StoredEvent {
  const id = "demo-event-id";
  const gifts: EventGift[] = [
    {
      id: "demo-honeymoon",
      eventId: id,
      title: "ירח דבש",
      description: "חופשה זוגית שמתחילה את הפרק הבא.",
      targetAmount: 8000,
      icon: "✈️",
      imageUrl: "",
      source: "catalog",
      priority: 0,
      active: true,
      storeId: null,
      storeName: "",
    },
    {
      id: "demo-sofa",
      eventId: id,
      title: "ספה חדשה",
      description: "ספה נוחה לבית החדש.",
      targetAmount: 4500,
      icon: "🛋️",
      imageUrl: "",
      source: "catalog",
      priority: 1,
      active: true,
      storeId: null,
      storeName: "",
    },
    {
      id: "demo-tv",
      eventId: id,
      title: "מסך טלוויזיה",
      description: "מסך גדול לסרטים ולמשחקים.",
      targetAmount: 3000,
      icon: "📺",
      imageUrl: "",
      source: "catalog",
      priority: 2,
      active: true,
      storeId: null,
      storeName: "",
    },
  ];

  return {
    id,
    slug: DEMO_EVENT_SLUG,
    title: "אירוע לדוגמה",
    hostName: "LOLO",
    eventType: "אחר",
    date: "",
    time: "",
    venueName: "",
    address: "",
    message: "זהו אירוע פיתוח לבדיקות. אירועים אמיתיים נשמרים בנפרד.",
    coverImage: "",
    giftMode: "catalog",
    moneyAmounts: [150, 250, 350, 500],
    allowCustomAmount: true,
    moneyDisplay: "amounts",
    gifts,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}
