import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createHostSessionToken } from "../lib/host/session";
import { handleHostImagePatch, type HostImageClient } from "../lib/host/event-images";
import {
  __clearTestCookies,
} from "./next-headers-stub.mjs";

const EVENT_A = "11111111-1111-4111-8111-111111111111";
const EVENT_B = "22222222-2222-4222-8222-222222222222";
const GUEST_B = "33333333-3333-4333-8333-333333333333";
const OWN_URL =
  "https://example.supabase.co/storage/v1/object/public/gift-images/covers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp";
type Row = { id: string; event_id: string; cover_image?: string; image_url?: string };
type Call = { table: string; payload: Record<string, string> };

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
                  calls.push({ table, payload });
                  const rows = table === "events" ? state.events : state.gifts;
                  const match = rows.find((row) =>
                    filters.every(([key, value]) => {
                      if (key === "id") return row.id === value;
                      if (key === "event_id") return row.event_id === value;
                      return false;
                    }),
                  );
                  if (!match) return { data: null, error: null };
                  if (table === "events" && "cover_image" in payload) match.cover_image = payload.cover_image;
                  if (table === "event_gifts" && "image_url" in payload) match.image_url = payload.image_url;
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

describe("two hosts cannot read or change each other's event", () => {
  beforeEach(() => {
    process.env.HOST_SESSION_SECRET = "host-isolation-test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    __clearTestCookies();
  });

  it("does not write host B's cover or gift when host A replaces or reverts", async () => {
    const calls: Call[] = [];
    const state = {
      events: [{ id: EVENT_B, event_id: EVENT_B, cover_image: "keep-b" }],
      gifts: [{ id: GUEST_B, event_id: EVENT_B, image_url: "gift-b" }],
    };
    const client = memoryClient(state, calls);
    const token = createHostSessionToken(EVENT_A);
    const replaced = await handleHostImagePatch({
      eventId: EVENT_B,
      token,
      body: { imageUrl: OWN_URL },
      client: () => client,
    });
    const reverted = await handleHostImagePatch({
      eventId: EVENT_B,
      token,
      body: { giftId: GUEST_B, imageUrl: "" },
      client: () => client,
    });
    assert.equal(replaced.status, 404);
    assert.equal(reverted.status, 404);
    assert.equal(calls.length, 0);
    assert.equal(state.events[0]?.cover_image, "keep-b");
    assert.equal(state.gifts[0]?.image_url, "gift-b");
  });

  it("does not write host A's cover when host B replaces it", async () => {
    const calls: Call[] = [];
    const state = {
      events: [{ id: EVENT_A, event_id: EVENT_A, cover_image: "keep-a" }],
      gifts: [] as Row[],
    };
    const replaced = await handleHostImagePatch({
      eventId: EVENT_A,
      token: createHostSessionToken(EVENT_B),
      body: { imageUrl: "" },
      client: () => memoryClient(state, calls),
    });
    assert.equal(replaced.status, 404);
    assert.equal(calls.length, 0);
    assert.equal(state.events[0]?.cover_image, "keep-a");
  });
});

describe("shared upload route guards", () => {
  const route = readFileSync(new URL("../app/api/uploads/images/route.ts", import.meta.url), "utf8");

  it("checks magic bytes, both size caps, and a rate limit, and ignores the client filename", () => {
    assert.match(route, /sniffImageType\(bytes\)/);
    assert.match(route, /contentLength > MAX_IMAGE_BYTES \+ MULTIPART_OVERHEAD/);
    assert.match(route, /file\.size > MAX_IMAGE_BYTES/);
    assert.match(route, /bytes\.byteLength > MAX_IMAGE_BYTES/);
    assert.match(route, /consumeUpload\(clientIpFromRequest\(request\)\)/);
    assert.match(route, /crypto\.randomUUID\(\)/);
    assert.doesNotMatch(route, /file\.name/);
    assert.doesNotMatch(route, /readHostSessionToken|requireHostEventSession/);
  });
});

