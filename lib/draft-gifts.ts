import { getGiftById } from "@/lib/gifts";

const DRAFT_GIFTS_KEY = "lolo-selected-gifts";

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 400;
const TARGET_MAX = 10_000_000;

export type DraftGiftSource = "custom" | "catalog";

export type DraftGift = {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  imageUrl: string;
  icon: string;
  storeId: string | null;
  source: DraftGiftSource;
};

function emptyStoreId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asPositiveAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > TARGET_MAX) {
    return 0;
  }
  return Math.round(amount * 100) / 100;
}

function fromCatalogId(giftId: string, storeId: string | null): DraftGift | null {
  const gift = getGiftById(giftId);
  if (!gift) {
    return null;
  }

  return {
    id: `catalog:${gift.id}`,
    title: gift.name,
    description: gift.description,
    targetAmount: gift.price,
    imageUrl: "",
    icon: gift.emoji,
    storeId,
    source: "catalog",
  };
}

function normalizeDraftGift(value: unknown): DraftGift | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!id || !title || title.length > TITLE_MAX) {
    return null;
  }

  const targetAmount = asPositiveAmount(record.targetAmount);
  if (!targetAmount) {
    return null;
  }

  const description =
    typeof record.description === "string"
      ? record.description.trim().slice(0, DESCRIPTION_MAX)
      : "";
  const imageUrl = typeof record.imageUrl === "string" ? record.imageUrl.trim() : "";
  const icon =
    typeof record.icon === "string" && record.icon.trim()
      ? record.icon.trim().slice(0, 16)
      : "🎁";

  return {
    id: id.slice(0, 80),
    title,
    description,
    targetAmount,
    imageUrl: imageUrl.slice(0, 500),
    icon,
    storeId: emptyStoreId(record.storeId),
    source: record.source === "catalog" ? "catalog" : "custom",
  };
}

function parseStoredItem(item: unknown): DraftGift | null {
  if (typeof item === "string") {
    return fromCatalogId(item, null);
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  if (typeof record.title === "string") {
    return normalizeDraftGift(record);
  }

  const giftId =
    typeof record.giftId === "string"
      ? record.giftId
      : typeof record.id === "string"
        ? record.id
        : "";
  if (!giftId) {
    return null;
  }

  return fromCatalogId(giftId, emptyStoreId(record.storeId));
}

function readStored(): { gifts: DraftGift[]; migrated: boolean } {
  if (typeof window === "undefined") {
    return { gifts: [], migrated: false };
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_GIFTS_KEY);
    if (!raw) {
      return { gifts: [], migrated: false };
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { gifts: [], migrated: false };
    }

    const seen = new Set<string>();
    const gifts: DraftGift[] = [];
    let migrated = false;

    for (const item of parsed) {
      const gift = parseStoredItem(item);
      if (!gift || seen.has(gift.id)) {
        migrated = true;
        continue;
      }
      seen.add(gift.id);
      gifts.push(gift);
      if (
        typeof item !== "object" ||
        item === null ||
        typeof (item as { title?: unknown }).title !== "string"
      ) {
        migrated = true;
      }
    }

    return { gifts, migrated };
  } catch {
    return { gifts: [], migrated: false };
  }
}

function writeStored(gifts: DraftGift[]) {
  window.localStorage.setItem(DRAFT_GIFTS_KEY, JSON.stringify(gifts));
}

export function loadDraftGifts(): DraftGift[] {
  const { gifts, migrated } = readStored();
  if (migrated) {
    writeStored(gifts);
  }
  return gifts;
}

export function hasDraftGifts() {
  return readStored().gifts.length > 0;
}

export function upsertDraftGift(gift: DraftGift) {
  const normalized = normalizeDraftGift(gift);
  if (!normalized) {
    return null;
  }

  const current = loadDraftGifts();
  const index = current.findIndex((item) => item.id === normalized.id);
  const next = [...current];
  if (index >= 0) {
    next[index] = normalized;
  } else {
    next.push(normalized);
  }
  writeStored(next);
  return normalized;
}

export function deleteDraftGift(id: string) {
  writeStored(loadDraftGifts().filter((gift) => gift.id !== id));
}

export function moveDraftGift(id: string, direction: -1 | 1) {
  const current = loadDraftGifts();
  const index = current.findIndex((gift) => gift.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
    return current;
  }

  const next = [...current];
  const [gift] = next.splice(index, 1);
  next.splice(nextIndex, 0, gift);
  writeStored(next);
  return next;
}

export function setDraftGiftStore(id: string, storeId: string | null) {
  const nextStoreId = storeId?.trim() || null;
  const next = loadDraftGifts().map((gift) =>
    gift.id === id ? { ...gift, storeId: nextStoreId } : gift,
  );
  writeStored(next);
  return next;
}

export function clearDraftGifts() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(DRAFT_GIFTS_KEY);
}

export function findDraftGift(id: string) {
  return loadDraftGifts().find((gift) => gift.id === id) ?? null;
}
