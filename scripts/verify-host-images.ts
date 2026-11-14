import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { MAX_IMAGE_BYTES } from "../lib/images/limits";
import { isHostUploadImageUrl } from "../lib/images/public-url";
import { sniffImageType } from "../lib/images/sniff";
import { signScopedPayload } from "../lib/security/hmac";
import { createHostSessionToken } from "../lib/host/session";
import {
  handleHostImagePatch,
  parseHostImageBody,
  saveHostEventImage,
  type HostImageClient,
} from "../lib/host/event-images";

const EVENT_A = "11111111-1111-4111-8111-111111111111";
const EVENT_B = "22222222-2222-4222-8222-222222222222";
const GIFT_A = "33333333-3333-4333-8333-333333333333";
const GIFT_B = "44444444-4444-4444-8444-444444444444";
const OWN_URL =
  "https://example.supabase.co/storage/v1/object/public/gift-images/covers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp";

type Row = {
  id: string;
  event_id: string;
  cover_image?: string;
  image_url?: string;
};

type Call = {
  table: string;
  payload: Record<string, string>;
  filters: Array<[string, string]>;
};

function memoryClient(state: { events: Row[]; gifts: Row[] }, calls: Call[]): HostImageClient {
  return {
    from(table: string) {
      return {
        update(payload: Record<string, string>) {
          const filters: Array<[string, string]> = [];
          const chain = {
            eq(column: string, value: string) {
              filters.push([column, value]);
              return chain;
            },
            select() {
              return {
                maybeSingle: async () => {
                  calls.push({ table, payload, filters: [...filters] });
                  const rows = table === "events" ? state.events : state.gifts;
                  const match = rows.find((row) =>
                    filters.every(([key, value]) => {
                      if (key === "id") return row.id === value;
                      if (key === "event_id") return row.event_id === value;
                      return false;
                    }),
                  );
                  if (!match) return { data: null, error: null };
                  if (table === "events" && "cover_image" in payload) {
                    match.cover_image = payload.cover_image;
                  }
                  if (table === "event_gifts" && "image_url" in payload) {
                    match.image_url = payload.image_url;
                  }
                  return { data: { id: match.id }, error: null };
                },
              };
            },
          };
          return chain;
        },
      };
    },
  };
}

function patch(
  eventId: string,
  body: unknown,
  token: string | undefined,
  client: HostImageClient,
) {
  return handleHostImagePatch({
    eventId,
    token,
    body,
    client: () => client,
  });
}

describe("host image replacement", () => {
  beforeEach(() => {
    process.env.HOST_SESSION_SECRET = "host-image-test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  });

  it("rejects an unauthenticated request with 401 and writes nothing", async () => {
    const calls: Call[] = [];
    const client = memoryClient(
      { events: [{ id: EVENT_A, event_id: EVENT_A, cover_image: "" }], gifts: [] },
      calls,
    );
    const response = await patch(EVENT_A, { imageUrl: OWN_URL }, undefined, client);
    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
  });

  it("rejects host A changing host B's event with 404 and writes nothing", async () => {
    const calls: Call[] = [];
    const state = {
      events: [{ id: EVENT_B, event_id: EVENT_B, cover_image: "keep" }],
      gifts: [] as Row[],
    };
    const client = memoryClient(state, calls);
    const token = createHostSessionToken(EVENT_A);
    const response = await patch(EVENT_B, { imageUrl: OWN_URL, title: "changed" }, token, client);
    assert.equal(response.status, 404);
    assert.equal(calls.length, 0);
    assert.equal(state.events[0]?.cover_image, "keep");
  });

  it("rejects a foreign gift and an external URL without changing stored images", async () => {
    const calls: Call[] = [];
    const state = {
      events: [{ id: EVENT_A, event_id: EVENT_A, cover_image: "" }],
      gifts: [{ id: GIFT_B, event_id: EVENT_B, image_url: "original" }],
    };
    const client = memoryClient(state, calls);
    const token = createHostSessionToken(EVENT_A);

    const external = await patch(EVENT_A, { imageUrl: "https://evil.test/photo.jpg" }, token, client);
    assert.equal(external.status, 400);
    assert.equal(calls.length, 0);

    const foreign = await patch(EVENT_A, { giftId: GIFT_B, imageUrl: OWN_URL }, token, client);
    assert.equal(foreign.status, 404);
    assert.equal(state.gifts[0]?.image_url, "original");
    assert.equal(calls.length, 1);
    assert.deepEqual(Object.keys(calls[0]?.payload ?? {}), ["image_url"]);
    assert.equal(calls[0]?.payload.image_url, OWN_URL);
  });

  it("saves a host upload and reverts only the image column", async () => {
    const calls: Call[] = [];
    const state = {
      events: [{ id: EVENT_A, event_id: EVENT_A, cover_image: "" }],
      gifts: [{ id: GIFT_A, event_id: EVENT_A, image_url: "" }],
    };
    const client = memoryClient(state, calls);
    const token = createHostSessionToken(EVENT_A);

    const saved = await patch(
      EVENT_A,
      { imageUrl: OWN_URL, title: "יום הולדת", paidAmount: 500 },
      token,
      client,
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.body.imageUrl, OWN_URL);
    assert.equal(state.events[0]?.cover_image, OWN_URL);
    assert.deepEqual(Object.keys(calls[0]?.payload ?? {}), ["cover_image"]);

    const reverted = await patch(EVENT_A, { giftId: GIFT_A, imageUrl: "   " }, token, client);
    assert.equal(reverted.status, 200);
    assert.equal(state.gifts[0]?.image_url, "");
    assert.deepEqual(Object.keys(calls[1]?.payload ?? {}), ["image_url"]);
    assert.equal(state.events[0]?.cover_image, OWN_URL);
  });

  it("parses a revert and refuses a library path", () => {
    assert.deepEqual(parseHostImageBody({ imageUrl: "" }), {
      ok: true,
      change: { kind: "cover", imageUrl: "" },
    });
    const library = parseHostImageBody({
      imageUrl: "/images/library/birthday/balloon-party-hero.webp",
    });
    assert.equal(library.ok, false);
  });

  it("does not update a gift that belongs to another event", async () => {
    const calls: Call[] = [];
    const state = {
      events: [{ id: EVENT_A, event_id: EVENT_A, cover_image: "cover" }],
      gifts: [{ id: GIFT_B, event_id: EVENT_B, image_url: "original" }],
    };
    const saved = await saveHostEventImage(memoryClient(state, calls), EVENT_A, {
      kind: "gift",
      giftId: GIFT_B,
      imageUrl: OWN_URL,
    });
    assert.deepEqual(saved, { ok: false, status: 404 });
    assert.equal(state.gifts[0]?.image_url, "original");
    assert.equal(state.events[0]?.cover_image, "cover");
    assert.equal(calls[0]?.table, "event_gifts");
    assert.deepEqual(calls[0]?.filters, [
      ["id", GIFT_B],
      ["event_id", EVENT_A],
    ]);
  });

  it("rejects a tampered or expired host session and writes nothing", async () => {
    const calls: Call[] = [];
    const state = {
      events: [{ id: EVENT_A, event_id: EVENT_A, cover_image: "kept" }],
      gifts: [] as Row[],
    };
    const client = memoryClient(state, calls);
    const token = createHostSessionToken(EVENT_A);
    const [encoded, signature] = token.split(".");
    const flipped = signature.endsWith("a") ? "b" : "a";
    const tampered = `${encoded}.${signature.slice(0, -1)}${flipped}`;
    const tamperedResult = await patch(EVENT_A, { imageUrl: OWN_URL }, tampered, client);
    assert.equal(tamperedResult.status, 401);

    const expiredPayload = Buffer.from(
      JSON.stringify({ typ: "host", eventId: EVENT_A, exp: Date.now() - 1000 }),
      "utf8",
    ).toString("base64url");
    const expired = `${expiredPayload}.${signScopedPayload("HOST_SESSION_SECRET", "host", expiredPayload)}`;
    const expiredResult = await patch(EVENT_A, { imageUrl: OWN_URL }, expired, client);
    assert.equal(expiredResult.status, 401);
    assert.equal(calls.length, 0);
    assert.equal(state.events[0]?.cover_image, "kept");
  });

  it("rejects urls that were not produced by the upload route", async () => {
    const origin = "https://example.supabase.co/storage/v1/object/public/gift-images";
    const rejected = [
      "https://evil.test/photo.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "/images/library/birthday/balloon-party-hero.webp",
      `${origin}/../other-bucket/x.jpg`,
      `${origin}/covers/..%2f..%2fother-bucket/x.jpg`,
      `${origin}-evil/covers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp`,
      "https://example.supabase.co/storage/v1/object/public/other-bucket/covers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp",
      `${origin}/covers/not-a-uuid.webp`,
      `${origin}/admin/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp`,
    ];
    const calls: Call[] = [];
    const state = {
      events: [{ id: EVENT_A, event_id: EVENT_A, cover_image: "kept" }],
      gifts: [{ id: GIFT_A, event_id: EVENT_A, image_url: "gift-kept" }],
    };
    const client = memoryClient(state, calls);
    const token = createHostSessionToken(EVENT_A);
    for (const imageUrl of rejected) {
      assert.equal(isHostUploadImageUrl(imageUrl), false, imageUrl);
      const response = await patch(EVENT_A, { imageUrl }, token, client);
      assert.equal(response.status, 400, imageUrl);
    }
    assert.equal(calls.length, 0);
    assert.equal(state.events[0]?.cover_image, "kept");
    assert.equal(state.gifts[0]?.image_url, "gift-kept");
    assert.equal(isHostUploadImageUrl(OWN_URL), true);
  });

  it("leaves both images untouched when the database rejects the write", async () => {
    const state = {
      events: [{ id: EVENT_A, event_id: EVENT_A, cover_image: "kept-cover" }],
      gifts: [{ id: GIFT_A, event_id: EVENT_A, image_url: "kept-gift" }],
    };
    const client: HostImageClient = {
      from() {
        return {
          update() {
            const chain = {
              eq() {
                return chain;
              },
              select() {
                return {
                  maybeSingle: async () => ({ data: null, error: { message: "timeout" } }),
                };
              },
            };
            return chain;
          },
        };
      },
    };
    await assert.rejects(() =>
      saveHostEventImage(client, EVENT_A, { kind: "cover", imageUrl: OWN_URL }),
    );
    assert.equal(state.events[0]?.cover_image, "kept-cover");
    assert.equal(state.gifts[0]?.image_url, "kept-gift");
  });

  it("writes only the targeted image column", async () => {
    const calls: Call[] = [];
    const state = {
      events: [{ id: EVENT_A, event_id: EVENT_A, cover_image: "old-cover" }],
      gifts: [{ id: GIFT_A, event_id: EVENT_A, image_url: "old-gift" }],
    };
    const client = memoryClient(state, calls);
    const token = createHostSessionToken(EVENT_A);
    const giftUrl =
      "https://example.supabase.co/storage/v1/object/public/gift-images/gifts/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png";
    const gift = await patch(EVENT_A, { giftId: GIFT_A, imageUrl: giftUrl, title: "x", amount: 9 }, token, client);
    assert.equal(gift.status, 200);
    assert.equal(state.gifts[0]?.image_url, giftUrl);
    assert.equal(state.events[0]?.cover_image, "old-cover");
    assert.deepEqual(Object.keys(calls[0]?.payload ?? {}), ["image_url"]);
    assert.equal(calls[0]?.table, "event_gifts");

    const cover = await patch(EVENT_A, { imageUrl: "" }, token, client);
    assert.equal(cover.status, 200);
    assert.equal(state.events[0]?.cover_image, "");
    assert.equal(state.gifts[0]?.image_url, giftUrl);
    assert.deepEqual(Object.keys(calls[1]?.payload ?? {}), ["cover_image"]);
    assert.equal(calls[1]?.table, "events");
    assert.deepEqual(
      calls.map((call) => call.table),
      ["event_gifts", "events"],
    );
  });

  it("accepts only jpeg, png, and webp magic bytes and caps uploads at 5MB", () => {
    assert.equal(MAX_IMAGE_BYTES, 5 * 1024 * 1024);
    assert.equal(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
    assert.equal(
      sniffImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/png",
    );
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    assert.equal(sniffImageType(webp), "image/webp");
    assert.equal(sniffImageType(Uint8Array.from([0x47, 0x49, 0x46, 0x38])), null);
    assert.equal(sniffImageType(new TextEncoder().encode("not-an-image")), null);

    const route = readFileSync(
      new URL("../app/api/uploads/images/route.ts", import.meta.url),
      "utf8",
    );
    assert.match(route, /sniffImageType\(bytes\)/);
    assert.match(route, /file\.size > MAX_IMAGE_BYTES/);
    assert.match(route, /bytes\.byteLength > MAX_IMAGE_BYTES/);
    assert.match(route, /contentLength > MAX_IMAGE_BYTES/);
    assert.doesNotMatch(route, /file\.type/);
  });
});

describe("host pages and routes stay on the signed-in event", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  it("redirects a host page when the session is missing or belongs to another event", () => {
    const dashboard = read("../app/host/events/[eventId]/page.tsx");
    const voucher = read("../app/host/events/[eventId]/vouchers/[voucherId]/page.tsx");
    for (const source of [dashboard, voucher]) {
      assert.match(source, /session\.eventId !== eventId/);
      assert.match(source, /redirect\("\/host"\)/);
      assert.equal(source.includes("accessCode"), false);
      assert.doesNotMatch(source, /HOST_SESSION_SECRET|SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY/);
    }
    assert.match(dashboard, /getHostDashboardData\(session\.eventId\)/);
    assert.match(voucher, /getHostVoucherCard\(eventId, voucherId, origin\)/);
    assert.match(read("../lib/vouchers/repository.ts"), /row\.event_id !== eventId/);
  });

  it("refuses host APIs without a matching session and writes with that session's event", () => {
    const guests = read("../app/api/host/events/[eventId]/guests/route.ts");
    const removal = read("../app/api/host/events/[eventId]/guests/[guestId]/route.ts");
    const vouchers = read("../app/api/host/events/[eventId]/vouchers/route.ts");
    const images = read("../app/api/host/events/[eventId]/images/route.ts");
    const imageHandler = read("../lib/host/event-images.ts");
    for (const source of [guests, removal, vouchers, images, imageHandler]) {
      assert.equal(source.includes("accessCode"), false);
      assert.doesNotMatch(source, /HOST_SESSION_SECRET|SERVICE_ROLE/);
    }
    for (const source of [guests, removal, vouchers, imageHandler]) {
      assert.match(source, /401/);
    }
    assert.match(guests, /requireHostEventSession\(eventId\)/);
    assert.match(guests, /addEventGuest\(session\.eventId/);
    assert.match(guests, /listEventGuests\(session\.eventId\)/);
    assert.match(removal, /requireHostEventSession\(eventId\)/);
    assert.match(removal, /deleteEventGuest\(session\.eventId, guestId\)/);
    assert.match(vouchers, /session\.eventId !== eventId/);
    assert.match(images, /handleHostImagePatch/);
    assert.match(read("../lib/host/guest-list.ts"), /session\.eventId !== eventId/);
    assert.match(read("../lib/host/event-images.ts"), /session\.eventId !== input\.eventId/);
  });
});
