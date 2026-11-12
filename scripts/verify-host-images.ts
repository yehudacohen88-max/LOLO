import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
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
  "https://example.supabase.co/storage/v1/object/public/gift-images/covers/host-photo.webp";

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
  });
});
