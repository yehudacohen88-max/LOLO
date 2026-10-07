import { loadDraftGifts } from "@/lib/draft-gifts";
import { loadEventDraft } from "@/lib/event-draft";
import { createEvent } from "./repository";
import type { EventGift, PublishedHostEvent } from "./types";

function moneyPlaceholder(): EventGift {
  return {
    id: "",
    eventId: "",
    title: "מתנה לאירוע",
    description: "השתתפות במתנה לאירוע.",
    targetAmount: 0,
    icon: "💝",
    imageUrl: "",
    source: "custom",
    priority: 0,
    active: true,
    storeId: null,
    storeName: "",
  };
}

export async function publishHostEvent(): Promise<PublishedHostEvent> {
  const draft = loadEventDraft();
  const draftGifts = draft.giftMode === "money" ? [] : loadDraftGifts();

  const gifts: EventGift[] =
    draftGifts.length > 0
      ? draftGifts.map((gift, index) => ({
          id: "",
          eventId: "",
          title: gift.title,
          description: gift.description,
          targetAmount: gift.targetAmount,
          icon: gift.icon || "🎁",
          imageUrl: gift.imageUrl,
          source: gift.source,
          priority: index,
          active: true,
          storeId: gift.storeId,
          storeName: "",
        }))
      : draft.giftMode === "money"
        ? [moneyPlaceholder()]
        : [];

  return createEvent(
    {
      id: "",
      slug: "",
      title: draft.eventName,
      hostName: draft.hostName,
      eventType: draft.eventType,
      date: draft.eventDate,
      time: draft.eventTime,
      venueName: draft.venueName,
      address: draft.address,
      message: draft.message,
      coverImage: draft.imageDataUrl,
      giftMode: draft.giftMode,
      moneyAmounts: draft.moneyAmounts,
      allowCustomAmount: draft.allowCustomAmount,
      moneyDisplay: draft.moneyDisplay,
      gifts,
      createdAt: "",
    },
    draft.guests,
  );
}
