export type EventGift = {
  id: string;
  eventId: string;
  title: string;
  description: string;
  targetAmount: number;
  icon: string;
  priority: number;
  active: boolean;
  storeId: string | null;
  storeName: string;
};

export type StoredEvent = {
  id: string;
  slug: string;
  title: string;
  hostName: string;
  eventType: string;
  date: string;
  time: string;
  venueName: string;
  address: string;
  message: string;
  coverImage: string;
  giftMode: "catalog" | "money" | "";
  moneyAmounts: number[];
  allowCustomAmount: boolean;
  moneyDisplay: "amounts" | "hidden";
  gifts: EventGift[];
  createdAt: string;
};

export type PublishedHostEvent = StoredEvent & {
  accessCode?: string;
};
