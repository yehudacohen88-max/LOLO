import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { BETA_CLARITY } from "@/app/design/beta-notice";

const ARTIFACTS = "/opt/cursor/artifacts/bold-after";
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440] as const;
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABLAAEBAAAAAAAAAAAAAAAAAAAABgEBAAAAAAAAAAAAAAAAAAAABhABAAAAAAAAAAAAAAAAAAAAABEBAAAAAAAAAAAAAAAAAAAAAP/AABEIAAgACAMBIgACEQADEQD/2gAMAwEAAhEDEQA/ALcApHn/2Q==",
  "base64",
);

const pages: Array<[string, string]> = [
  ["/", "home"],
  ["/create-event?new=1", "create-step-1"],
  ["/create-event/gifts", "create-gifts"],
  ["/create-event/gifts/money", "create-money"],
  ["/create-event/gifts/catalog", "create-catalog"],
  ["/create-event/gifts/custom", "create-custom"],
  ["/create-event/gifts/organize", "create-organize"],
  ["/create-event/details", "create-details"],
  ["/create-event/guests", "create-guests"],
  ["/create-event/preview", "create-preview"],
  ["/create-event/success", "create-success"],
];

function shot(page: Page, name: string) {
  mkdirSync(ARTIFACTS, { recursive: true });
  return page.screenshot({ path: `${ARTIFACTS}/${name}.png`, fullPage: true });
}

async function overflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe("bold home and creation", () => {
  test.describe.configure({ timeout: 180_000 });

  test("home states the value, the steps, and a yellow create action", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "המתנה שבאמת רציתם, ביחד." })).toBeVisible();
    await expect(
      page.getByText("האורחים משתתפים יחד במתנה שהחוגג באמת רוצה. החוגג מקבל שובר דיגיטלי לבית עסק שבחר."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "איך זה עובד" })).toBeVisible();
    await expect(page.getByText("בבטא התשלום הוא הדגמה, בלי חיוב אמיתי.")).toBeVisible();
    await expect(page.getByText(BETA_CLARITY)).toBeVisible();
    await expect(page.getByRole("link", { name: "יוצרים אירוע" })).toHaveCSS(
      "background-color",
      "rgb(255, 184, 77)",
    );
    await expect(page.locator("[data-bold-home] img").first()).toHaveAttribute(
      "src",
      /\/images\/library\//,
    );
    const stage = await page.evaluate(() => getComputedStyle(document.querySelector("[data-bold-home]")!).backgroundColor);
    expect(stage).toBe("rgb(23, 47, 43)");
  });

  test("a new event shows library defaults and the host can replace then revert", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "lolo-event-draft",
        JSON.stringify({
          eventType: "יום הולדת",
          eventName: "יום ההולדת של יובל",
          eventDate: "2026-11-12",
          hostName: "נועה",
          imageDataUrl: "",
          giftMode: "catalog",
        }),
      );
    });
    await page.route("**/api/uploads/images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "http://127.0.0.1:3000/__photo__/host.jpg" }),
      });
    });
    await page.route("**/__photo__/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "image/jpeg", body: TINY_JPEG });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/create-event/details");
    const libraryCover = page.locator("[data-image-source='library'][src*='candle-layer-cake']");
    await expect(libraryCover.first()).toBeVisible();
    await expect(page.locator("[data-illustrative-label]")).toHaveCount(0);
    await shot(page, "host-replace-default-390");

    await page.locator('input[accept="image/*"]').setInputFiles({
      name: "cover.jpg",
      mimeType: "image/jpeg",
      buffer: TINY_JPEG,
    });
    const hostCover = page.getByRole("img", { name: "תצוגה מקדימה של תמונת האירוע" });
    await expect(hostCover).toHaveAttribute("src", /host\.jpg/);
    await expect(hostCover).toHaveAttribute("data-image-source", "host");
    await expect(page.locator("[data-illustrative-label]")).toHaveCount(0);
    await shot(page, "host-replace-upload-390");

    await page.getByRole("button", { name: "הסרת תמונה" }).click();
    await expect(libraryCover.first()).toBeVisible();
    await expect(page.locator("[data-image-source='host']")).toHaveCount(0);
    const draft = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("lolo-event-draft") || "{}"),
    );
    expect(draft.imageDataUrl).toBe("");
    await shot(page, "host-replace-revert-390");

    await page.setViewportSize({ width: 1440, height: 900 });
    await shot(page, "host-replace-revert-1440");
    await page.goto("/create-event/details");
    await page.locator('input[accept="image/*"]').setInputFiles({
      name: "cover.jpg",
      mimeType: "image/jpeg",
      buffer: TINY_JPEG,
    });
    await expect(hostCover).toBeVisible();
    await shot(page, "host-replace-upload-1440");
    await page.getByRole("button", { name: "הסרת תמונה" }).click();
    await shot(page, "host-replace-default-1440");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/create-event/gifts/custom");
    await expect(page.locator("[data-illustrative-label]")).toHaveText("תמונה להמחשה");
    await expect(page.locator("[data-image-source='library']").first()).toBeVisible();
    await page.getByLabel("שם המתנה").fill("מכונת קפה");
    await expect(page.locator("[data-image-source='library'][src*='/coffee/']").first()).toBeVisible();
    await expect(page.locator("[data-illustrative-label]")).toHaveText("תמונה להמחשה");

    await page.locator('input[accept="image/*"]').setInputFiles({
      name: "gift.jpg",
      mimeType: "image/jpeg",
      buffer: TINY_JPEG,
    });
    await expect(page.locator("[data-image-source='host']")).toBeVisible();
    await expect(page.locator("[data-illustrative-label]")).toHaveCount(0);
    await page.getByRole("button", { name: "הסרת תמונה" }).click();
    await expect(page.locator("[data-illustrative-label]")).toHaveText("תמונה להמחשה");
    await expect(page.locator("[data-image-source='host']")).toHaveCount(0);
  });

  test("publishing keeps an empty host image so the library stays a default", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "lolo-event-draft",
        JSON.stringify({
          eventType: "חתונה",
          eventName: "החתונה של דנה",
          eventDate: "2026-12-01",
          hostName: "משפחה",
          imageDataUrl: "",
          giftMode: "money",
          moneyAmounts: [150],
          allowCustomAmount: true,
          moneyDisplay: "amounts",
        }),
      );
    });
    let coverImage = "missing";
    await page.route("**/api/events", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const body = route.request().postDataJSON() as { coverImage?: string; gifts?: Array<{ imageUrl?: string }> };
      coverImage = body.coverImage ?? "";
      expect(body.gifts?.[0]?.imageUrl ?? "").toBe("");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "22222222-2222-4222-8222-222222222222",
          slug: "wedding-demo",
          accessCode: "AA11-BB22",
          event: {
            id: "22222222-2222-4222-8222-222222222222",
            slug: "wedding-demo",
            title: "החתונה של דנה",
            hostName: "משפחה",
            eventType: "חתונה",
            date: "2026-12-01",
            time: "",
            venueName: "",
            address: "",
            message: "",
            coverImage: "",
            giftMode: "money",
            moneyAmounts: [150],
            allowCustomAmount: true,
            moneyDisplay: "amounts",
            gifts: [],
            createdAt: "2026-11-01T00:00:00.000Z",
          },
        }),
      });
    });

    await page.goto("/create-event/preview");
    await expect(page.locator("[data-image-source='library'][src*='/wedding/']").first()).toBeVisible();
    await page.getByRole("button", { name: "יצירת האירוע" }).click();
    await expect(page).toHaveURL(/\/create-event\/success\?slug=wedding-demo/);
    expect(coverImage).toBe("");
  });

  test("home, creation steps, and the host default stay in frame", async ({ page }) => {
    const failures: string[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
      for (const [url, name] of pages) {
        await page.goto(url);
        await expect(page.locator("main").first()).toBeVisible();
        const extra = await overflow(page);
        if (extra > 1) {
          failures.push(`${name} ${width} overflow ${extra}`);
        }
        if (width === 390 || width === 1440) {
          await shot(page, `${name}-${width}`);
          if (width === 390 || width === 1440) {
            const axe = await new AxeBuilder({ page }).analyze();
            const serious = axe.violations.filter(
              (item) => item.impact === "serious" || item.impact === "critical",
            );
            if (serious.length) {
              failures.push(
                `${name} ${width} axe ${serious
                  .map((item) => `${item.id}:${item.nodes.length}`)
                  .join(", ")}`,
              );
            }
          }
        }
      }
      await page.goto("/host/example");
      const extra = await overflow(page);
      if (extra > 1) {
        failures.push(`host-images ${width} overflow ${extra}`);
      }
      if (width === 390 || width === 1440) {
        await expect(page.locator("[data-image-source='library']").first()).toBeVisible();
        await expect(page.locator("[data-illustrative-label]").first()).toHaveText("תמונה להמחשה");
        await shot(page, `host-images-${width}`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
