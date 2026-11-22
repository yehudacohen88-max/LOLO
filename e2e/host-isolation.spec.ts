import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

const SECRET = "playwright-host-isolation-secret";
const EVENT_A = "11111111-1111-4111-8111-111111111111";
const EVENT_B = "22222222-2222-4222-8222-222222222222";
const GUEST_B = "33333333-3333-4333-8333-333333333333";
const VOUCHER_B = "55555555-5555-4555-8555-555555555555";
const MARKER = "סודי-של-מארח-ב";

function hostToken(eventId: string) {
  const payload = Buffer.from(
    JSON.stringify({ typ: "host", eventId, exp: Date.now() + 60 * 60 * 1000 }),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", SECRET).update(`host:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

test.describe("host A and host B stay isolated", () => {
  test.describe.configure({ timeout: 60_000 });

  test("pages and APIs refuse the other host and an anonymous caller", async ({ page, request }) => {
    const results: string[] = [];

    async function checkPage(actor: string | null, target: string, voucher = false) {
      const path = voucher
        ? `/host/events/${target}/vouchers/${VOUCHER_B}`
        : `/host/events/${target}`;
      await page.context().clearCookies();
      if (actor) {
        await page.context().addCookies([
          {
            name: "lolo_host_session",
            value: hostToken(actor),
            url: "http://127.0.0.1:3000",
          },
        ]);
      }
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/host$/);
      const html = await page.locator("body").innerText();
      const redirected = true;
      const leaked = html.includes(MARKER) || html.includes("accessCode");
      const label = `${actor ?? "anonymous"} page ${path}`;
      if (!redirected || leaked) {
        results.push(`FAIL ${label} url=${url} leaked=${leaked}`);
      } else {
        results.push(`PASS ${label}`);
      }
    }

    await checkPage(null, EVENT_A);
    await checkPage(null, EVENT_B, true);
    await checkPage(EVENT_A, EVENT_B);
    await checkPage(EVENT_A, EVENT_B, true);
    await checkPage(EVENT_B, EVENT_A);
    await checkPage(EVENT_B, EVENT_A, true);

    const calls: Array<{
      actor: string | null;
      method: string;
      path: string;
      status: number;
      data?: Record<string, unknown>;
    }> = [];
    for (const actor of [null, EVENT_A, EVENT_B] as const) {
      const other = actor === EVENT_A ? EVENT_B : EVENT_A;
      const target = actor ? other : EVENT_B;
      const imageStatus = actor ? 404 : 401;
      calls.push(
        { actor, method: "GET", path: `/api/host/events/${target}/guests`, status: 401 },
        {
          actor,
          method: "POST",
          path: `/api/host/events/${target}/guests`,
          status: 401,
          data: { name: MARKER, phone: "0500000000" },
        },
        {
          actor,
          method: "DELETE",
          path: `/api/host/events/${target}/guests/${GUEST_B}`,
          status: 401,
        },
        {
          actor,
          method: "PATCH",
          path: `/api/host/events/${target}/images`,
          status: imageStatus,
          data: { imageUrl: "" },
        },
        {
          actor,
          method: "POST",
          path: `/api/host/events/${target}/vouchers`,
          status: 401,
          data: { giftId: "x", storeId: "y", expectedAmount: 1 },
        },
      );
    }

    for (const call of calls) {
      const response = await request.fetch(call.path, {
        method: call.method,
        data: call.data,
        headers: call.actor
          ? { cookie: `lolo_host_session=${hostToken(call.actor)}` }
          : {},
      });
      const text = await response.text();
      const label = `${call.actor ?? "anonymous"} ${call.method} ${call.path}`;
      if (response.status() !== call.status || text.includes(MARKER)) {
        results.push(`FAIL ${label} status=${response.status()} body=${text.slice(0, 180)}`);
      } else {
        results.push(`PASS ${label}`);
      }
    }

    const failed = results.filter((line) => line.startsWith("FAIL"));
    expect(failed, results.join("\n")).toEqual([]);
  });

  test("the shared upload route checks bytes, size, and rate, and is not a host session", async ({
    request,
  }) => {
    const spoofed = await request.post("/api/uploads/images", {
      multipart: {
        file: {
          name: "photo.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
        },
        kind: "../covers",
      },
    });
    expect(spoofed.status()).toBe(400);

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    const first = await request.post("/api/uploads/images", {
      multipart: {
        file: { name: "first.jpg", mimeType: "text/plain", buffer: jpeg },
      },
      headers: { "x-forwarded-for": "203.0.113.44" },
    });
    expect(first.status(), "a valid jpeg is not blocked for lack of a host session").toBe(503);

    let limited = first.status();
    for (let count = 0; count < 30 && limited !== 429; count += 1) {
      const response = await request.post("/api/uploads/images", {
        multipart: {
          file: { name: `n-${count}.jpg`, mimeType: "image/jpeg", buffer: jpeg },
        },
        headers: { "x-forwarded-for": "203.0.113.44" },
      });
      limited = response.status();
      if (limited === 429) break;
    }
    expect(limited).toBe(429);
  });
});
