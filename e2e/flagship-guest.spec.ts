import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const artifactDir = process.env.FLAGSHIP_ARTIFACT_DIR || "/opt/cursor/artifacts";
// Mockup photos for this test only. They are not the guest page's default images.
const portraitPath = path.join(__dirname, "fixtures/flagship/portrait.jpg");
const giftPath = path.join(__dirname, "fixtures/flagship/gift.png");

const widths = [
  { name: "320", width: 320, height: 640 },
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
] as const;

function eventPayload(withImages: boolean) {
  return {
    event: {
      id: "flagship-fixture-id",
      slug: "flagship-fixture",
      title: "חוגגים 40 לדנה",
      hostName: "נועה לוי",
      eventType: "יום הולדת",
      date: "2026-11-06",
      time: "19:00",
      venueName: "תל אביב",
      address: "",
      message: "השנה החלטנו להפתיע את דנה במשהו שהיא באמת חולמת עליו.",
      coverImage: withImages ? "/__flagship_fixture/portrait.jpg" : "",
      giftMode: "catalog",
      moneyAmounts: [200, 350, 500],
      allowCustomAmount: true,
      moneyDisplay: "amounts",
      gifts: [
        {
          id: "gift-espresso",
          eventId: "flagship-fixture-id",
          title: "מכונת אספרסו פרימיום",
          description: "מכונה לבית.",
          targetAmount: 4800,
          icon: "",
          imageUrl: withImages ? "/__flagship_fixture/gift.png" : "",
          source: "custom",
          priority: 0,
          active: true,
          storeId: null,
          storeName: "מעבדת הקפה",
        },
      ],
      createdAt: "2026-10-01T00:00:00.000Z",
    },
  };
}

const fundingPayload = {
  gifts: [
    {
      giftId: "gift-espresso",
      raisedAmount: 4500,
      contributorCount: 23,
      percentOfTarget: 93.75,
    },
  ],
};

async function installFixture(page: Page, withImages: boolean) {
  await page.route("**/api/events/flagship-fixture/funding", async (route) => {
    await route.fulfill({ json: fundingPayload });
  });
  await page.route("**/api/events/flagship-fixture", async (route) => {
    await route.fulfill({ json: eventPayload(withImages) });
  });
  if (withImages) {
    await page.route("**/__flagship_fixture/portrait.jpg", async (route) => {
      await route.fulfill({ path: portraitPath, contentType: "image/jpeg" });
    });
    await page.route("**/__flagship_fixture/gift.png", async (route) => {
      await route.fulfill({ path: giftPath, contentType: "image/png" });
    });
  }
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1400);
}

test("guest page keeps contribution flow and hides an empty invitation", async ({ page }) => {
  await installFixture(page, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e/flagship-fixture");
  await expect(page.getByRole("heading", { name: /חוגגים 40 לדנה/ })).toBeVisible();
  await expect(page.getByText("השנה החלטנו להפתיע את דנה")).toBeVisible();
  await expect(page.getByText("הזמנה מאת נועה לוי")).toBeVisible();
  await expect(page.getByText("23 חברים")).toBeVisible();
  await expect(page.getByText("יונתן")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "מצטרפים למתנה" })).toBeDisabled();

  await page.getByRole("button", { name: /350/ }).click();
  const join = page.getByRole("button", { name: "מצטרפים למתנה" });
  await expect(join).toBeEnabled();
  await join.click();
  await expect(page).toHaveURL(/\/e\/flagship-fixture\/greeting/);
  await expect(page.getByRole("heading", { name: "משאירים ברכה" })).toBeVisible();

  await page.unroute("**/api/events/flagship-fixture");
  await page.route("**/api/events/flagship-fixture", async (route) => {
    const body = eventPayload(false);
    body.event.message = "   ";
    body.event.hostName = "";
    await route.fulfill({ json: body });
  });
  await page.goto("/e/flagship-fixture");
  await expect(page.getByRole("heading", { name: /חוגגים 40 לדנה/ })).toBeVisible();
  await expect(page.getByText("השנה החלטנו להפתיע את דנה")).toHaveCount(0);
  await expect(page.getByText("הזמנה מאת")).toHaveCount(0);
});

test("bundled demo event does not invent guests or ship a stock portrait", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e/demo-event");
  await expect(page.getByRole("heading", { name: "אירוע לדוגמה" })).toBeVisible();
  await expect(page.getByText("ירח דבש")).toBeVisible();
  await expect(page.getByText("ספה חדשה")).toBeVisible();
  await expect(page.getByText("אין עדיין משתתפים")).toBeVisible();
  await expect(page.getByText("יונתן")).toHaveCount(0);
  await expect(page.getByText("23 חברים")).toHaveCount(0);
  const srcs = await page.locator("img").evaluateAll((images) =>
    images.map((image) => (image as HTMLImageElement).currentSrc || image.getAttribute("src") || ""),
  );
  expect(srcs.join(" ")).not.toMatch(/dana|pexels|7244751/i);
  await page.screenshot({
    path: path.join(artifactDir, "flagship_guest_demo_390.png"),
    fullPage: true,
  });
});

for (const viewport of widths) {
  for (const withImages of [true, false] as const) {
    const label = withImages ? "with_images" : "without_images";
    test(`screenshot ${viewport.name} ${label}`, async ({ page }) => {
      await installFixture(page, withImages);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/e/flagship-fixture");
      await expect(page.getByRole("heading", { name: /חוגגים/ })).toBeVisible();
      await expect(page.getByText("תשלום הדגמה — לא מתבצע חיוב אמיתי")).toBeVisible();
      if (withImages) {
        await expect(page.locator("img[alt='תמונה לאירוע חוגגים 40 לדנה']")).toBeVisible();
      } else {
        await expect(page.locator("img[alt='תמונה לאירוע חוגגים 40 לדנה']")).toHaveCount(0);
      }
      await settle(page);
      const file = path.join(
        artifactDir,
        `flagship_guest_${viewport.name}_${label}.png`,
      );
      await page.screenshot({ path: file, fullPage: true });
      if (viewport.name === "390" && withImages) {
        await page.screenshot({
          path: path.join(artifactDir, "flagship_guest_390_with_images_fold.png"),
          fullPage: false,
        });
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
}
