import "server-only";
import { buildDemoEvent, DEMO_EVENT_SLUG } from "@/lib/events/demo";
import { mapGuestEvent, type GuestEventRow, type GuestGiftRow } from "@/lib/events/guest-shape";
import { normalizeEventSlug } from "@/lib/events/slug";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const EVENT_COLUMNS =
  "id, slug, title, host_name, event_type, event_date, event_time, venue_name, address, message, cover_image, gift_mode, money_amounts, allow_custom_amount, money_display, created_at";

const GIFT_COLUMNS = [
  "id, event_id, title, description, target_amount, icon, image_url, source, priority, active, store_name",
  "id, event_id, title, description, target_amount, icon, image_url, source, priority, active",
  "id, event_id, title, description, target_amount, icon, priority, active",
  "id, event_id, title, target_amount, icon, priority, active",
];

export async function loadGuestEvent(slug: string) {
  const decoded = normalizeEventSlug(slug);
  if (!decoded) {
    return null;
  }
  if (decoded === DEMO_EVENT_SLUG) {
    return buildDemoEvent();
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("slug", decoded)
    .maybeSingle();

  if (error) {
    console.error("[LOLO] guest event lookup failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error("טעינת האירוע נכשלה.");
  }
  if (!data) {
    return null;
  }

  const gifts = await loadGifts(supabase, String(data.id));
  return mapGuestEvent(data as GuestEventRow, gifts);
}

async function loadGifts(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  eventId: string,
) {
  for (const columns of GIFT_COLUMNS) {
    const { data, error } = await supabase
      .from("event_gifts")
      .select(columns)
      .eq("event_id", eventId)
      .order("priority", { ascending: true });
    if (!error) {
      return (data ?? []) as unknown as GuestGiftRow[];
    }
    console.error("[LOLO] guest gift lookup failed for a column set", {
      code: error.code,
      message: error.message,
    });
  }
  throw new Error("טעינת המתנות נכשלה.");
}
