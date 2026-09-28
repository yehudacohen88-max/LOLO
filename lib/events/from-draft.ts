import { loadEventDraft } from "@/lib/event-draft";
import { loadSelectedGifts } from "@/lib/gifts";
import { createEvent } from "./repository";
import type { EventGift, PublishedHostEvent } from "./types";

export async function publishHostEvent(): Promise<PublishedHostEvent> {
  const draft = loadEventDraft();
  const catalogGifts =
    draft.giftMode === "money" ? [] : loadSelectedGifts();

  const gifts: EventGift[] =
    catalogGifts.length > 0
      ? catalogGifts.map((gift, index) => ({
          id: "",
          eventId: "",
          title: gift.name,
          description: gift.description,
          targetAmount: gift.price,
          icon: gift.emoji,
          priority: index,
          active: true,
        }))
      : [
          {
            id: "",
            eventId: "",
            title: "מתנה לאירוע",
            description: "השתתפות במתנה לאירוע.",
            targetAmount: 0,
            icon: "💝",
            priority: 0,
            active: true,
          },
        ];

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
