import { clearDraftGifts, hasDraftGifts } from "./draft-gifts";

export type Guest = {
  id: string;
  name: string;
  phone: string;
};

export type EventDraft = {
  eventType: string;
  eventName: string;
  eventDate: string;
  hostName: string;
  venueName: string;
  address: string;
  eventTime: string;
  message: string;
  imageDataUrl: string;
  videoName: string;
  guests: Guest[];
  excelFileName: string;
  giftMode: "catalog" | "money" | "";
  moneyAmounts: number[];
  allowCustomAmount: boolean;
  moneyDisplay: "amounts" | "hidden";
};

const EVENT_DRAFT_KEY = "lolo-event-draft";

const emptyDraft: EventDraft = {
  eventType: "",
  eventName: "",
  eventDate: "",
  hostName: "",
  venueName: "",
  address: "",
  eventTime: "",
  message: "",
  imageDataUrl: "",
  videoName: "",
  guests: [],
  excelFileName: "",
  giftMode: "",
  moneyAmounts: [],
  allowCustomAmount: true,
  moneyDisplay: "amounts",
};

let videoPreviewUrl = "";

export const DEMO_EVENT_URL = "https://lolo.co.il/e/demo-event";

export function loadEventDraft(): EventDraft {
  if (typeof window === "undefined") {
    return emptyDraft;
  }

  try {
    const raw = window.localStorage.getItem(EVENT_DRAFT_KEY);
    if (!raw) {
      return emptyDraft;
    }

    const parsed = JSON.parse(raw) as Partial<EventDraft>;
    const guests = Array.isArray(parsed.guests)
      ? parsed.guests.filter(
          (guest): guest is Guest =>
            Boolean(guest) &&
            typeof guest.id === "string" &&
            typeof guest.name === "string" &&
            typeof guest.phone === "string",
        )
      : [];

    const moneyAmounts = Array.isArray(parsed.moneyAmounts)
      ? parsed.moneyAmounts.filter(
          (amount): amount is number =>
            typeof amount === "number" && Number.isFinite(amount) && amount > 0,
        )
      : [];

    return {
      ...emptyDraft,
      ...parsed,
      guests,
      moneyAmounts,
      allowCustomAmount: parsed.allowCustomAmount !== false,
      moneyDisplay: parsed.moneyDisplay === "hidden" ? "hidden" : "amounts",
      giftMode:
        parsed.giftMode === "catalog" || parsed.giftMode === "money"
          ? parsed.giftMode
          : "",
    };
  } catch {
    return emptyDraft;
  }
}

export class DraftStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftStorageError";
  }
}

const DRAFT_SAVE_FAILED = "לא הצלחנו לשמור את הפרטים. נסו שוב.";
const DRAFT_IMAGE_TOO_BIG =
  "לא הצלחנו לשמור את התמונה. היא גדולה מדי. הסירו אותה או בחרו תמונה אחרת.";
const DRAFT_STORAGE_FULL =
  "לא הצלחנו לשמור. הזיכרון בדפדפן מלא. הסירו את התמונה או נסו שוב.";

function isQuotaError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22)
  );
}

export function saveEventDraft(patch: Partial<EventDraft>) {
  const next = { ...loadEventDraft(), ...patch };
  const incomingImage = Object.prototype.hasOwnProperty.call(patch, "imageDataUrl")
    ? patch.imageDataUrl ?? ""
    : "";

  if (incomingImage.startsWith("data:") && incomingImage.length > 500_000) {
    throw new DraftStorageError(DRAFT_IMAGE_TOO_BIG);
  }

  try {
    window.localStorage.setItem(EVENT_DRAFT_KEY, JSON.stringify(next));
  } catch (error) {
    if (error instanceof DraftStorageError) {
      throw error;
    }
    if (isQuotaError(error) && next.imageDataUrl.startsWith("data:")) {
      throw new DraftStorageError(DRAFT_IMAGE_TOO_BIG);
    }
    throw new DraftStorageError(isQuotaError(error) ? DRAFT_STORAGE_FULL : DRAFT_SAVE_FAILED);
  }

  return next;
}

export function hasUnfinishedEventDraft() {
  if (typeof window === "undefined") {
    return false;
  }

  const draft = loadEventDraft();
  return Boolean(
    draft.eventType ||
      draft.eventName.trim() ||
      draft.eventDate ||
      draft.hostName.trim() ||
      draft.venueName.trim() ||
      draft.address.trim() ||
      draft.eventTime ||
      draft.message.trim() ||
      draft.imageDataUrl ||
      draft.videoName ||
      draft.guests.length ||
      draft.excelFileName ||
      draft.giftMode ||
      draft.moneyAmounts.length ||
      hasDraftGifts(),
  );
}

export function resetEventCreationDraft() {
  if (videoPreviewUrl) {
    URL.revokeObjectURL(videoPreviewUrl);
  }
  videoPreviewUrl = "";

  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(EVENT_DRAFT_KEY);
  clearDraftGifts();
}

export function getVideoPreviewUrl() {
  return videoPreviewUrl;
}

export function setVideoPreviewUrl(url: string) {
  if (videoPreviewUrl && videoPreviewUrl !== url) {
    URL.revokeObjectURL(videoPreviewUrl);
  }
  videoPreviewUrl = url;
}

export function formatEventDate(date: string) {
  if (!date) {
    return "";
  }

  const parsed = new Date(`${date}T00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatEventTime(time: string) {
  if (!time) {
    return "";
  }

  const [hours, minutes] = time.split(":");
  if (!hours || !minutes) {
    return time;
  }

  return `${hours}:${minutes}`;
}
