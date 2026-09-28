import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { createUniqueSlug } from "@/lib/events/slug";
import {
  generateHostAccessCode,
  hashHostAccessCode,
} from "@/lib/host/access-code";
import {
  insertEventGuests,
} from "@/lib/host/guest-list";
import { parseGuestList } from "@/lib/host/guest-fields";
import type { EventGift, StoredEvent } from "@/lib/events/types";

export type PublishEventInput = {
  title?: string;
  hostName?: string;
  eventType?: string;
  date?: string;
  time?: string;
  venueName?: string;
  address?: string;
  message?: string;
  coverImage?: string;
  giftMode?: string;
  moneyAmounts?: unknown;
  allowCustomAmount?: boolean;
  moneyDisplay?: string;
  gifts?: unknown;
  guests?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asGiftMode(value: unknown): StoredEvent["giftMode"] {
  return value === "catalog" || value === "money" ? value : "";
}

function asMoneyDisplay(value: unknown): StoredEvent["moneyDisplay"] {
  return value === "hidden" ? "hidden" : "amounts";
}

function asMoneyAmounts(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as number[];
  }

  return value.filter(
    (amount): amount is number =>
      typeof amount === "number" && Number.isFinite(amount) && amount > 0,
  );
}

function asGifts(value: unknown): Omit<EventGift, "id" | "eventId">[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      {
        title: "מתנה לאירוע",
        description: "השתתפות במתנה לאירוע.",
        targetAmount: 0,
        icon: "💝",
        priority: 0,
        active: true,
      },
    ];
  }

  const gifts = value
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const gift = item as Record<string, unknown>;
      const title = asString(gift.title);
      const targetAmount = Number(gift.targetAmount);
      const priority = Number(gift.priority);

      return {
        title,
        description: asString(gift.description),
        targetAmount: Number.isFinite(targetAmount) ? targetAmount : 0,
        icon: asString(gift.icon) || "🎁",
        priority: Number.isFinite(priority) ? priority : index,
        active: gift.active !== false,
      };
    })
    .filter((gift): gift is Omit<EventGift, "id" | "eventId"> => Boolean(gift));

  gifts.sort((a, b) => a.priority - b.priority);

  return gifts.map((gift, index) => ({
    ...gift,
    priority: index,
  }));
}

async function listSlugs() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from("events").select("slug");
  if (error) {
    throw new Error("בדיקת כתובת האירוע נכשלה.");
  }
  return (data ?? []).map((row) => String(row.slug));
}

export async function publishEventOnServer(
  input: PublishEventInput,
): Promise<StoredEvent & { accessCode: string }> {
  const title = asString(input.title);
  const hostName = asString(input.hostName);
  const giftMode = asGiftMode(input.giftMode);
  const gifts = asGifts(input.gifts);
  const guests = parseGuestList(input.guests);

  if (gifts.length === 0) {
    throw new Error("נא לבחור לפחות מתנה אחת.");
  }

  const supabase = getSupabaseServiceClient();
  const existingSlugs = await listSlugs();
  const id = crypto.randomUUID();
  let slug = createUniqueSlug(title || hostName || "event", existingSlugs);
  const createdAt = new Date().toISOString();
  let coverImage = asString(input.coverImage);

  const eventRow = {
    id,
    slug,
    title,
    host_name: hostName,
    event_type: asString(input.eventType),
    event_date: asString(input.date),
    event_time: asString(input.time),
    venue_name: asString(input.venueName),
    address: asString(input.address),
    message: asString(input.message),
    cover_image: coverImage,
    gift_mode: giftMode,
    money_amounts: asMoneyAmounts(input.moneyAmounts),
    allow_custom_amount: input.allowCustomAmount !== false,
    money_display: asMoneyDisplay(input.moneyDisplay),
    created_at: createdAt,
  };

  let inserted = false;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    eventRow.slug = slug;
    eventRow.cover_image = coverImage;

    const { error } = await supabase.from("events").insert(eventRow);

    if (!error) {
      inserted = true;
      break;
    }

    if (error.code === "23505") {
      slug = createUniqueSlug(title || hostName || "event", [
        ...existingSlugs,
        slug,
      ]);
      existingSlugs.push(slug);
      continue;
    }

    if (coverImage) {
      coverImage = "";
      continue;
    }

    throw new Error("שמירת האירוע נכשלה.");
  }

  if (!inserted) {
    throw new Error("כתובת האירוע כבר קיימת. נסו שוב.");
  }

  const giftRows = gifts.map((gift) => ({
    id: crypto.randomUUID(),
    event_id: id,
    title: gift.title,
    description: gift.description,
    target_amount: gift.targetAmount,
    icon: gift.icon,
    priority: gift.priority,
    active: gift.active,
  }));

  const { error: giftError } = await supabase.from("event_gifts").insert(giftRows);

  if (giftError) {
    await supabase.from("events").delete().eq("id", id);
    throw new Error("שמירת המתנות נכשלה.");
  }

  const accessCode = generateHostAccessCode();
  const codeHash = await hashHostAccessCode(accessCode);
  const { error: accessError } = await supabase.from("event_host_access").insert({
    event_id: id,
    code_hash: codeHash,
  });

  if (accessError) {
    await supabase.from("events").delete().eq("id", id);
    throw new Error("שמירת האירוע נכשלה.");
  }

  try {
    await insertEventGuests(id, guests);
  } catch {
    await supabase.from("events").delete().eq("id", id);
    throw new Error("שמירת רשימת האורחים נכשלה.");
  }

  return {
    id,
    slug,
    title,
    hostName,
    eventType: asString(input.eventType),
    date: asString(input.date),
    time: asString(input.time),
    venueName: asString(input.venueName),
    address: asString(input.address),
    message: asString(input.message),
    coverImage,
    giftMode,
    moneyAmounts: asMoneyAmounts(input.moneyAmounts),
    allowCustomAmount: input.allowCustomAmount !== false,
    moneyDisplay: asMoneyDisplay(input.moneyDisplay),
    gifts: giftRows.map((gift) => ({
      id: gift.id,
      eventId: gift.event_id,
      title: gift.title,
      description: gift.description,
      targetAmount: Number(gift.target_amount) || 0,
      icon: gift.icon,
      priority: gift.priority,
      active: gift.active,
    })),
    createdAt,
    accessCode,
  };
}
