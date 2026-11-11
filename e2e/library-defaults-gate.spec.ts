import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const gatedOrigin = "http://127.0.0.1:3001";
const portraitPath = path.join(__dirname, "fixtures/flagship/portrait.jpg");
const giftPath = path.join(__dirname, "fixtures/flagship/gift.png");

test.use({ baseURL: gatedOrigin });

function storedEvent(withHostImages: boolean) {
  return {
    event: {
      id: "stored-defaults-id",
      slug: withHostImages ? "stored-host-images" : "stored-no-images",
      title: "LOLO | בדיקת משתמשים — בטא 2",
      hostName: "בודק בטא",
      eventType: "אחר",
      date: "2026-11-15",
      time: "19:00",
      venueName: "",
      address: "",
      message: "",
      coverImage: withHostImages ? "/__flagship_fixture/portrait.jpg" : "",
      giftMode: "catalog",
      moneyAmounts: [150, 250],
      allowCustomAmount: true,
      moneyDisplay: "amounts",
      gifts: [
        {
          id: "gift-trip",
          eventId: "stored-defaults-id",
          title: "חופשה זוגית",
          description: "סוף שבוע לשניים.",
          targetAmount: 3200,
          icon: "",
          imageUrl: withHostImages ? "/__flagship_fixture/gift.png" : "",
          source: "custom",
          priority: 0,
          active: true,
          storeId: null,
          storeName: "",
        },
        {
          id: "gift-coffee",
          eventId: "stored-defaults-id",
          title: "מכונת קפה",
          description: "לבית.",
          targetAmount: 1800,
          icon: "",
          imageUrl: "",
          source: "custom",
          priority: 1,
          active: true,
          storeId: null,
          storeName: "",
        },
      ],
      createdAt: "2026-11-01T00:00:00.000Z",
    },
  };
}

async function mockStoredEvent(page: Page, slug: string, withHostImages: boolean) {
  await page.route(`**/api/events/${slug}/funding`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.abort();
      return;
    }
    await route.fulfill({ json: { gifts: [] } });
  });
  await page.route(`**/api/events/${slug}`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.abort();
      return;
    }
    await route.fulfill({ json: storedEvent(withHostImages) });
  });
  await page.route("**/api/invite/identity**", async (route) => {
    await route.fulfill({ status: 404, json: {} });
  });
  await page.route("**/__flagship_fixture/portrait.jpg", async (route) => {
    await route.fulfill({ path: portraitPath, contentType: "image/jpeg" });
  });
  await page.route("**/__flagship_fixture/gift.png", async (route) => {
    await route.fulfill({ path: giftPath, contentType: "image/png" });
  });
}

test("a gated static avif loads, and a stored event without host photos shows library images", async ({ page }) => {
  const avif = await page.request.get("/images/library/festive/pendant-lights-hero.avif", {
    maxRedirects: 0,
  });
  expect(avif.status()).toBe(200);
  expect(avif.headers()["content-type"] ?? "").toContain("image/avif");

  const webp = await page.request.get("/images/library/festive/pendant-lights-hero.webp");
  expect(webp.status()).toBe(200);

  const gated = await page.request.get("/host", { maxRedirects: 0 });
  expect([301, 302, 303, 307, 308]).toContain(gated.status());
  expect(gated.headers().location ?? "").toContain("/beta");

  await mockStoredEvent(page, "stored-no-images", false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e/stored-no-images");
  await expect(page.getByRole("heading", { name: /בדיקת משתמשים/ })).toBeVisible();
  await expect(page.locator("[data-portrait]")).toHaveAttribute("src", /\/images\/library\/.+\.webp$/);
  await expect(page.locator("[data-portrait]")).toHaveAttribute("data-image-source", "library");
  const gifts = page.locator("[data-gift-photo]");
  await expect(gifts).toHaveCount(2);
  const sources = await gifts.evaluateAll((images) => images.map((image) => image.getAttribute("src") || ""));
  expect(sources.some((src) => src.includes("/images/library/travel/"))).toBe(true);
  expect(sources.some((src) => src.includes("/images/library/coffee/"))).toBe(true);
  expect(sources.join(" ")).not.toContain("__flagship_fixture");
  await expect(page.locator("[data-image-source='library']")).toHaveCount(3);
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-celebration] img")].every(
      (image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 10,
    ),
  );
  const loaded = await page.locator("[data-celebration] img").evaluateAll((images) =>
    images.map((image) => (image as HTMLImageElement).naturalWidth),
  );
  expect(loaded.length).toBeGreaterThanOrEqual(3);
  expect(loaded.every((width) => width > 10)).toBe(true);
});

test("a host image still wins when the beta gate is on", async ({ page }) => {
  await mockStoredEvent(page, "stored-host-images", true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/e/stored-host-images");
  await expect(page.locator("[data-portrait]")).toHaveAttribute("src", "/__flagship_fixture/portrait.jpg");
  await expect(page.locator("[data-portrait]")).toHaveAttribute("data-image-source", "host");
  await expect(page.locator("[data-cele='feature'] [data-gift-photo]")).toHaveAttribute(
    "src",
    "/__flagship_fixture/gift.png",
  );
  await expect(page.locator("[data-cele='feature'] [data-gift-photo]")).toHaveAttribute(
    "data-image-source",
    "host",
  );
  const loaded = await page.locator("[data-portrait], [data-cele='feature'] [data-gift-photo]").evaluateAll(
    (images) => images.map((image) => (image as HTMLImageElement).naturalWidth),
  );
  expect(loaded.every((width) => width > 10)).toBe(true);
});
