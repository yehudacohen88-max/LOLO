import { capEventText, EVENT_FIELD_LIMITS } from "@/lib/events/text-limits";
import { INVITATION_GREETING_LIMIT } from "@/lib/host/invitation-message";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const EVENT_EDIT_GIFT_LIMIT = 30;

export type EventEditGift = {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  icon: string;
  imageUrl: string;
  storeId: string | null;
  priority: number;
  active: boolean;
};

export type EventEditLock = {
  id: string;
  orderCount: number;
  paidAmount: number;
  voucherCount: number;
};

export type EventEditCurrent = {
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
  gifts: EventEditGift[];
};

export type EventEditDetails = {
  title: string;
  hostName: string;
  eventType: string;
  date: string;
  time: string;
  venueName: string;
  address: string;
  message: string;
  coverImage: string;
  invitationGreeting: string | null;
};

export type PlannedGiftWrite = {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  icon: string;
  imageUrl: string;
  storeId: string | null;
  priority: number;
  active: boolean;
  isNew: boolean;
};

export type EventEditPlan = {
  details: EventEditDetails;
  gifts: PlannedGiftWrite[] | null;
  removeIds: string[];
};

export type EventEditResult =
  | { ok: true; plan: EventEditPlan }
  | { ok: false; error: string };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function money(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) {
    return null;
  }
  return Math.round(amount * 100) / 100;
}

function sameMoney(left: number, right: number) {
  return Math.round(left * 100) === Math.round(right * 100);
}

function asDate(value: string) {
  if (!value) {
    return "";
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function asTime(value: string) {
  if (!value) {
    return "";
  }
  return /^\d{2}:\d{2}$/.test(value) ? value : null;
}

function lockFor(locks: EventEditLock[], id: string) {
  return (
    locks.find((lock) => lock.id === id) ?? {
      id,
      orderCount: 0,
      paidAmount: 0,
      voucherCount: 0,
    }
  );
}

function hasOrders(lock: EventEditLock) {
  return lock.orderCount > 0 || lock.voucherCount > 0;
}

export function planEventEdit(input: {
  current: EventEditCurrent;
  patch: Record<string, unknown>;
  locks: EventEditLock[];
  includeGreeting: boolean;
  coverIsUpload: (url: string) => boolean;
  imageIsUpload: (url: string) => boolean;
  newGiftId: () => string;
}): EventEditResult {
  if ("slug" in input.patch) {
    const requested = text(input.patch.slug);
    if (requested && requested !== input.current.slug) {
      return { ok: false, error: "קישור האורחים נשאר קבוע." };
    }
  }

  const title = "title" in input.patch
    ? capEventText(input.patch.title, EVENT_FIELD_LIMITS.title)
    : input.current.title;
  if (!title) {
    return { ok: false, error: "נא להזין שם אירוע." };
  }

  const date = "date" in input.patch ? asDate(text(input.patch.date)) : input.current.date;
  if (date == null) {
    return { ok: false, error: "התאריך אינו תקין." };
  }
  const time = "time" in input.patch ? asTime(text(input.patch.time)) : input.current.time;
  if (time == null) {
    return { ok: false, error: "השעה אינה תקינה." };
  }

  let coverImage = input.current.coverImage;
  if ("coverImage" in input.patch) {
    const nextCover = text(input.patch.coverImage);
    if (nextCover !== input.current.coverImage) {
      if (nextCover && !input.coverIsUpload(nextCover)) {
        return { ok: false, error: "אפשר לשמור רק תמונה שהועלתה ל-LOLO." };
      }
      coverImage = nextCover;
    }
  }

  let invitationGreeting: string | null = null;
  if (input.includeGreeting && "invitationGreeting" in input.patch) {
    invitationGreeting = text(input.patch.invitationGreeting).slice(0, INVITATION_GREETING_LIMIT);
  }

  const details: EventEditDetails = {
    title,
    hostName: ("hostName" in input.patch
      ? text(input.patch.hostName)
      : input.current.hostName
    ).slice(0, 80),
    eventType: ("eventType" in input.patch
      ? text(input.patch.eventType)
      : input.current.eventType
    ).slice(0, 40),
    date,
    time,
    venueName: "venueName" in input.patch
      ? capEventText(input.patch.venueName, EVENT_FIELD_LIMITS.venueName)
      : input.current.venueName,
    address: "address" in input.patch
      ? capEventText(input.patch.address, EVENT_FIELD_LIMITS.address)
      : input.current.address,
    message: "message" in input.patch
      ? capEventText(input.patch.message, EVENT_FIELD_LIMITS.message)
      : input.current.message,
    coverImage,
    invitationGreeting,
  };

  if (!("gifts" in input.patch)) {
    return { ok: true, plan: { details, gifts: null, removeIds: [] } };
  }

  if (!Array.isArray(input.patch.gifts)) {
    return { ok: false, error: "רשימת המתנות אינה תקינה." };
  }
  if (input.patch.gifts.length === 0 || input.patch.gifts.length > EVENT_EDIT_GIFT_LIMIT) {
    return { ok: false, error: "נא להשאיר לפחות מתנה אחת, ועד 30 מתנות." };
  }

  const currentById = new Map(input.current.gifts.map((gift) => [gift.id, gift]));
  const seen = new Set<string>();
  const gifts: PlannedGiftWrite[] = [];

  for (const item of input.patch.gifts) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "רשימת המתנות אינה תקינה." };
    }
    const row = item as Record<string, unknown>;
    const rawId = text(row.id);
    const isNew = rawId === "";
    if (!isNew && !currentById.has(rawId)) {
      return { ok: false, error: "המתנה לא נמצאה." };
    }
    if (!isNew && seen.has(rawId)) {
      return { ok: false, error: "המתנה מופיעה פעמיים." };
    }
    if (!isNew) {
      seen.add(rawId);
    }

    const current = isNew ? null : currentById.get(rawId)!;
    const lock = isNew
      ? { id: "", orderCount: 0, paidAmount: 0, voucherCount: 0 }
      : lockFor(input.locks, rawId);
    const titleText = text(row.title).slice(0, 80);
    if (!titleText) {
      return { ok: false, error: "נא להזין שם מתנה." };
    }
    const targetAmount = money(row.targetAmount);
    if (targetAmount == null) {
      return { ok: false, error: "סכום היעד אינו תקין." };
    }
    if (current && lock.paidAmount > 0 && !sameMoney(targetAmount, current.targetAmount)) {
      return { ok: false, error: "אי אפשר לשנות יעד של מתנה שכבר שולמה." };
    }

    let storeId: string | null = null;
    if ("storeId" in row && row.storeId != null && text(row.storeId)) {
      storeId = text(row.storeId);
      if (!UUID.test(storeId)) {
        return { ok: false, error: "נבחרה חנות לא תקינה." };
      }
    }
    if (current && lock.voucherCount > 0 && storeId !== current.storeId) {
      return { ok: false, error: "אי אפשר לשנות חנות של מתנה שכבר הונפק לה שובר." };
    }

    const active = row.active !== false;
    if (current && !active && hasOrders(lock)) {
      return { ok: false, error: "אי אפשר להסתיר מתנה שכבר יש עליה הזמנות או שובר." };
    }

    let imageUrl = current?.imageUrl ?? "";
    if ("imageUrl" in row) {
      const nextImage = text(row.imageUrl);
      if (nextImage !== imageUrl) {
        if (nextImage && !input.imageIsUpload(nextImage)) {
          return { ok: false, error: "אפשר לשמור רק תמונה שהועלתה ל-LOLO." };
        }
        imageUrl = nextImage;
      }
    }

    gifts.push({
      id: isNew ? input.newGiftId() : rawId,
      title: titleText,
      description: text(row.description).slice(0, 400),
      targetAmount,
      icon: text(row.icon).slice(0, 16) || "🎁",
      imageUrl,
      storeId,
      priority: gifts.length,
      active,
      isNew,
    });
  }

  const removeIds = input.current.gifts
    .map((gift) => gift.id)
    .filter((id) => !seen.has(id));
  for (const id of removeIds) {
    if (hasOrders(lockFor(input.locks, id))) {
      return { ok: false, error: "אי אפשר להסיר מתנה שכבר יש עליה הזמנות או שובר." };
    }
  }

  if (!gifts.some((gift) => gift.active)) {
    return { ok: false, error: "נא להשאיר לפחות מתנה אחת פעילה." };
  }

  return { ok: true, plan: { details, gifts, removeIds } };
}
