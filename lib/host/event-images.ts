import "server-only";
import { isOwnGiftImageUrl } from "@/lib/images/public-url";
import { readHostSessionToken } from "@/lib/host/session";

export type HostImageChange =
  | { kind: "cover"; imageUrl: string }
  | { kind: "gift"; giftId: string; imageUrl: string };

type SaveResult = { ok: true; imageUrl: string } | { ok: false; status: 404 };

type UpdateChain = {
  update: (payload: Record<string, string>) => {
    eq: (
      column: string,
      value: string,
    ) => {
      eq: (
        column: string,
        value: string,
      ) => {
        select: (columns: string) => {
          maybeSingle: () => PromiseLike<{ data: { id: string } | null; error: { message?: string } | null }>;
        };
      };
      select: (columns: string) => {
        maybeSingle: () => PromiseLike<{ data: { id: string } | null; error: { message?: string } | null }>;
      };
    };
  };
};

export type HostImageClient = {
  from: (table: string) => UpdateChain;
};

export function parseHostImageBody(body: unknown): { ok: true; change: HostImageChange } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "הבקשה אינה תקינה." };
  }
  const record = body as Record<string, unknown>;
  if (typeof record.imageUrl !== "string") {
    return { ok: false, error: "הבקשה אינה תקינה." };
  }
  const imageUrl = record.imageUrl.trim();
  if (imageUrl && !isOwnGiftImageUrl(imageUrl)) {
    return { ok: false, error: "אפשר לשמור רק תמונה שהועלתה ל-LOLO." };
  }
  if (Object.prototype.hasOwnProperty.call(record, "giftId")) {
    if (typeof record.giftId !== "string" || !record.giftId.trim() || record.giftId.trim().length > 80) {
      return { ok: false, error: "המתנה לא נמצאה." };
    }
    return { ok: true, change: { kind: "gift", giftId: record.giftId.trim(), imageUrl } };
  }
  return { ok: true, change: { kind: "cover", imageUrl } };
}

function rowResult(
  data: { id: string } | null,
  error: { message?: string } | null,
  imageUrl: string,
): SaveResult {
  if (error) {
    throw new Error("שמירת התמונה נכשלה.");
  }
  if (!data?.id) {
    return { ok: false, status: 404 };
  }
  return { ok: true, imageUrl };
}

export async function handleHostImagePatch(input: {
  eventId: string;
  token: string | undefined;
  body: unknown;
  client: () => HostImageClient;
}): Promise<{ status: number; body: { error?: string; imageUrl?: string } }> {
  const session = readHostSessionToken(input.token);
  if (!session) {
    return { status: 401, body: { error: "אין הרשאה." } };
  }
  if (!input.eventId || session.eventId !== input.eventId) {
    return { status: 404, body: { error: "אין הרשאה." } };
  }
  const parsed = parseHostImageBody(input.body);
  if (!parsed.ok) {
    return { status: 400, body: { error: parsed.error } };
  }
  const saved = await saveHostEventImage(input.client(), input.eventId, parsed.change);
  if (!saved.ok) {
    return { status: saved.status, body: { error: "לא נמצא." } };
  }
  return { status: 200, body: { imageUrl: saved.imageUrl } };
}

export async function saveHostEventImage(
  client: HostImageClient,
  eventId: string,
  change: HostImageChange,
): Promise<SaveResult> {
  if (change.kind === "cover") {
    const { data, error } = await client
      .from("events")
      .update({ cover_image: change.imageUrl })
      .eq("id", eventId)
      .select("id")
      .maybeSingle();
    return rowResult(data, error, change.imageUrl);
  }

  const { data, error } = await client
    .from("event_gifts")
    .update({ image_url: change.imageUrl })
    .eq("id", change.giftId)
    .eq("event_id", eventId)
    .select("id")
    .maybeSingle();
  return rowResult(data, error, change.imageUrl);
}
