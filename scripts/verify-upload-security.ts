import assert from "node:assert/strict";
import sharp from "sharp";
import { beforeEach, describe, it } from "node:test";
import { createBetaSessionValue } from "../lib/beta/gate";
import { handleHostImagePatch, type HostImageClient } from "../lib/host/event-images";
import { createHostSessionToken } from "../lib/host/session";
import { UPLOAD_GRANT_HEADER } from "../lib/images/active-upload-grant";
import { isHostUploadImageUrl } from "../lib/images/public-url";
import { receiveImageUpload, type UploadStorage } from "../lib/images/receive-upload";
import { inspectImage } from "../lib/images/sniff";
import { createImageUploadGrant } from "../lib/images/upload-grant";
import {
  UPLOAD_LIMIT_PER_IP,
  UPLOAD_LIMIT_PER_PRINCIPAL,
  resetUploadLimits,
} from "../lib/security/upload-limit";

const EVENT_A = "11111111-1111-4111-8111-111111111111";
const EVENT_B = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://example.supabase.co";

type Stored = {
  path: string;
  bytes: Uint8Array;
  options: { contentType: string; upsert: false; cacheControl: string };
};

type Row = { id: string; event_id: string; cover_image?: string; image_url?: string };

function mockStorage() {
  const calls: Stored[] = [];
  const storage: UploadStorage = {
    async upload(path, bytes, options) {
      calls.push({ path, bytes, options });
      return { error: null };
    },
    getPublicUrl(path) {
      return {
        data: { publicUrl: `${ORIGIN}/storage/v1/object/public/gift-images/${path}` },
      };
    },
  };
  return { calls, storage };
}

function imageRequest(bytes: Uint8Array, headers: Record<string, string> = {}, kind = "cover") {
  const file = new File([Uint8Array.from(bytes)], "photo.bin", { type: "application/octet-stream" });
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  return new Request("http://local.test/api/uploads/images", {
    method: "POST",
    body: form,
    headers,
  });
}

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, Buffer.from(type), data, Buffer.alloc(4)]);
}

function pngWithDimensions(width: number, height: number) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = Buffer.from([0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function tiny(type: "png" | "jpeg" | "webp") {
  const image = sharp({
    create: { width: 8, height: 6, channels: 3, background: { r: 20, g: 80, b: 40 } },
  });
  if (type === "png") {
    return image.png().toBuffer();
  }
  if (type === "webp") {
    return image.webp().toBuffer();
  }
  return image.jpeg().toBuffer();
}

function grantHeader(extra: Record<string, string> = {}) {
  const token = createImageUploadGrant();
  assert.ok(token);
  return { [UPLOAD_GRANT_HEADER]: token, ...extra };
}

function memoryClient(state: { events: Row[]; gifts: Row[] }): HostImageClient {
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

describe("image upload authorization and integrity", () => {
  beforeEach(() => {
    process.env.HOST_SESSION_SECRET = "upload-host-secret";
    process.env.BETA_ACCESS_SECRET = "upload-beta-secret";
    process.env.IMAGE_UPLOAD_SECRET = "upload-grant-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGIN;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    resetUploadLimits();
  });

  it("returns 401 and does not call storage without a session or grant", async () => {
    const png = await tiny("png");
    const { calls, storage } = mockStorage();
    const result = await receiveImageUpload({
      request: imageRequest(png, { "x-forwarded-for": "203.0.113.10" }),
      storage,
    });
    assert.equal(result.status, 401);
    assert.equal(calls.length, 0);
  });

  it("accepts a beta session during event creation without a host session", async () => {
    delete process.env.IMAGE_UPLOAD_SECRET;
    const png = await tiny("png");
    const beta = await createBetaSessionValue("upload-beta-secret");
    const { calls, storage } = mockStorage();
    const result = await receiveImageUpload({
      request: imageRequest(png, { "x-real-ip": "203.0.113.20" }),
      betaToken: beta,
      storage,
    });
    assert.equal(result.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(isHostUploadImageUrl(result.body.url ?? ""), true);
    assert.match(calls[0].path, /^covers\/[0-9a-f-]{36}\.png$/);
    assert.equal(calls[0].options.upsert, false);
    assert.equal(calls[0].options.contentType, "image/png");
  });

  it("accepts a create-event upload grant and stores a re-encoded image", async () => {
    const png = await tiny("png");
    const { calls, storage } = mockStorage();
    const result = await receiveImageUpload({
      request: imageRequest(png, grantHeader({ "x-real-ip": "203.0.113.30" }), "gift"),
      storage,
    });
    assert.equal(result.status, 200);
    assert.equal(calls.length, 1);
    assert.match(calls[0].path, /^gifts\/[0-9a-f-]{36}\.png$/);
    assert.equal(calls[0].options.upsert, false);
    assert.equal(calls[0].options.cacheControl, "31536000");
    assert.equal(inspectImage(calls[0].bytes).ok, true);
    assert.equal(Buffer.compare(Buffer.from(calls[0].bytes), png) === 0, false);
  });

  it("rejects an expired or tampered upload grant before storage", async () => {
    const png = await tiny("png");
    const now = 1_700_000_000_000;
    const expired = createImageUploadGrant(now - 3 * 60 * 60 * 1000);
    assert.ok(expired);
    const { calls, storage } = mockStorage();
    const stale = await receiveImageUpload({
      request: imageRequest(png, { [UPLOAD_GRANT_HEADER]: expired }),
      storage,
      now,
    });
    assert.equal(stale.status, 401);
    assert.equal(calls.length, 0);

    const token = createImageUploadGrant() ?? "";
    const [encoded, signature] = token.split(".");
    const flipped = signature.endsWith("a") ? "b" : "a";
    const tampered = await receiveImageUpload({
      request: imageRequest(png, {
        [UPLOAD_GRANT_HEADER]: `${encoded}.${signature.slice(0, -1)}${flipped}`,
      }),
      storage,
    });
    assert.equal(tampered.status, 401);
    assert.equal(calls.length, 0);
  });

  it("accepts a host session and the url can be saved only on that host's event", async () => {
    delete process.env.IMAGE_UPLOAD_SECRET;
    const jpeg = await tiny("jpeg");
    const token = createHostSessionToken(EVENT_A);
    const { calls, storage } = mockStorage();
    const uploaded = await receiveImageUpload({
      request: imageRequest(jpeg, { "x-vercel-forwarded-for": "203.0.113.40" }),
      hostToken: token,
      storage,
    });
    assert.equal(uploaded.status, 200);
    const url = uploaded.body.url ?? "";
    assert.equal(isHostUploadImageUrl(url), true);
    assert.equal(calls[0].options.contentType, "image/jpeg");
    assert.match(calls[0].path, /\.jpg$/);

    const state = {
      events: [
        { id: EVENT_A, event_id: EVENT_A, cover_image: "" },
        { id: EVENT_B, event_id: EVENT_B, cover_image: "keep-b" },
      ],
      gifts: [] as Row[],
    };
    const client = memoryClient(state);
    const own = await handleHostImagePatch({
      eventId: EVENT_A,
      token,
      body: { imageUrl: url },
      client: () => client,
    });
    const other = await handleHostImagePatch({
      eventId: EVENT_B,
      token,
      body: { imageUrl: url },
      client: () => client,
    });
    assert.equal(own.status, 200);
    assert.equal(other.status, 404);
    assert.equal(state.events[0]?.cover_image, url);
    assert.equal(state.events[1]?.cover_image, "keep-b");
  });

  it("does not let a spoofed x-forwarded-for reset the ip or the principal counter", async () => {
    const png = await tiny("png");
    const token = createImageUploadGrant();
    assert.ok(token);
    const codes: number[] = [];
    for (let index = 0; index < UPLOAD_LIMIT_PER_IP + 3; index += 1) {
      const result = await receiveImageUpload({
        request: imageRequest(png, {
          [UPLOAD_GRANT_HEADER]: token,
          "x-real-ip": "203.0.113.50",
          "x-forwarded-for": `1.2.3.${index}`,
        }),
        storage: mockStorage().storage,
      });
      codes.push(result.status);
    }
    assert.equal(codes.filter((status) => status === 200).length, UPLOAD_LIMIT_PER_IP);
    assert.equal(codes.at(-1), 429);

    const stillLimited = await receiveImageUpload({
      request: imageRequest(png, {
        [UPLOAD_GRANT_HEADER]: token,
        "x-real-ip": "203.0.113.50",
        "x-forwarded-for": "198.51.100.200",
      }),
      storage: mockStorage().storage,
    });
    assert.equal(stillLimited.status, 429);

    const rotatedPrincipal = await receiveImageUpload({
      request: imageRequest(png, {
        ...grantHeader(),
        "x-real-ip": "203.0.113.50",
        "x-forwarded-for": "203.0.113.77",
      }),
      storage: mockStorage().storage,
    });
    assert.equal(rotatedPrincipal.status, 429);

    const freshAddress = await receiveImageUpload({
      request: imageRequest(png, {
        ...grantHeader(),
        "x-vercel-forwarded-for": "198.51.100.8",
        "x-real-ip": "203.0.113.50",
        "x-forwarded-for": "1.1.1.1",
      }),
      storage: mockStorage().storage,
    });
    assert.equal(freshAddress.status, 200);

    resetUploadLimits();
    const sharedUnknown = createImageUploadGrant();
    assert.ok(sharedUnknown);
    let accepted = 0;
    for (let index = 0; index < UPLOAD_LIMIT_PER_IP + 5; index += 1) {
      const result = await receiveImageUpload({
        request: imageRequest(png, {
          [UPLOAD_GRANT_HEADER]: sharedUnknown,
          "x-forwarded-for": `9.9.${index}.4`,
        }),
        storage: mockStorage().storage,
      });
      if (result.status === 200) {
        accepted += 1;
      }
    }
    assert.equal(accepted, UPLOAD_LIMIT_PER_IP);

    resetUploadLimits();
    let acrossIps = 0;
    for (let index = 0; index < UPLOAD_LIMIT_PER_PRINCIPAL + 4; index += 1) {
      const result = await receiveImageUpload({
        request: imageRequest(png, {
          [UPLOAD_GRANT_HEADER]: sharedUnknown,
          "x-real-ip": `198.51.100.${index + 1}`,
        }),
        storage: mockStorage().storage,
      });
      if (result.status === 200) {
        acrossIps += 1;
      }
    }
    assert.equal(acrossIps, UPLOAD_LIMIT_PER_PRINCIPAL);
  });

  it("rejects a jpeg header, a trailing polyglot, gif, and svg without writing", async () => {
    const headers = grantHeader({ "x-real-ip": "203.0.113.60" });
    const jpeg = await tiny("jpeg");
    const cases = [
      Uint8Array.from([0xff, 0xd8, 0xff]),
      Uint8Array.from([0xff, 0xd8, 0xff, 0x00]),
      Buffer.concat([jpeg, Buffer.from("<?php system($_GET['cmd']); ?>")]),
      Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00"),
      Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"8000\" height=\"8000\"></svg>"),
    ];
    for (const bytes of cases) {
      const { calls, storage } = mockStorage();
      const result = await receiveImageUpload({
        request: imageRequest(bytes, headers),
        storage,
      });
      assert.equal(result.status, 400, Buffer.from(bytes).subarray(0, 8).toString("hex"));
      assert.equal(calls.length, 0);
    }
  });

  it("rejects oversized pixel dimensions under 5MB without writing", async () => {
    const { calls, storage } = mockStorage();
    const result = await receiveImageUpload({
      request: imageRequest(
        pngWithDimensions(5000, 5000),
        grantHeader({ "x-real-ip": "203.0.113.70" }),
      ),
      storage,
    });
    assert.equal(result.status, 400);
    assert.match(result.body.error ?? "", /גדולה מדי/);
    assert.equal(calls.length, 0);
    assert.ok(pngWithDimensions(5000, 5000).byteLength < 5 * 1024 * 1024);
  });

  it("re-encodes jpeg, png, and webp and keeps the public upload path", async () => {
    for (const type of ["jpeg", "png", "webp"] as const) {
      const original = await tiny(type);
      const { calls, storage } = mockStorage();
      const result = await receiveImageUpload({
        request: imageRequest(original, grantHeader({ "x-real-ip": `203.0.113.${type.length + 80}` })),
        storage,
      });
      assert.equal(result.status, 200, type);
      assert.equal(calls.length, 1);
      const inspected = inspectImage(calls[0].bytes);
      assert.equal(inspected.ok, true);
      assert.equal(isHostUploadImageUrl(result.body.url ?? ""), true);
    }
  });
});
