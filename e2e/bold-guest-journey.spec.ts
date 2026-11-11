import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const artifactDir = process.env.FLAGSHIP_ARTIFACT_DIR || "/opt/cursor/artifacts";
const portraitPath = path.join(__dirname, "fixtures/flagship/portrait.jpg");
const giftPath = path.join(__dirname, "fixtures/flagship/gift.png");

const widths = [320, 360, 390, 768, 1024, 1440] as const;

const screens = [
  ["greeting", "/e/flagship-fixture/greeting", "מוסיפים ברכה אישית"],
  ["details", "/e/flagship-fixture/details", "למי נגיד תודה?"],
  ["payment", "/e/flagship-fixture/payment", "כמעט סיימנו"],
  ["thanks", "/e/flagship-fixture/thank-you", "איזה כיף, השתתפת במתנה!"],
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
      venueName: "הבית של נועה",
      address: "דיזנגוף 100, תל אביב",
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

async function installReadRoutes(page: Page, withImages: boolean) {
  await page.route("**/api/events/flagship-fixture/funding", async (route) => {
    await route.fulfill({
      json: {
        gifts: [
          {
            giftId: "gift-espresso",
            raisedAmount: 4500,
            contributorCount: 23,
            percentOfTarget: 93.75,
          },
        ],
      },
    });
  });
  await page.route("**/api/events/flagship-fixture", async (route) => {
    await route.fulfill({ json: eventPayload(withImages) });
  });
  await page.route("**/__flagship_fixture/portrait.jpg", async (route) => {
    await route.fulfill({ path: portraitPath, contentType: "image/jpeg" });
  });
  await page.route("**/__flagship_fixture/gift.png", async (route) => {
    await route.fulfill({ path: giftPath, contentType: "image/png" });
  });
  await page.route("**/api/invite/identity**", async (route) => {
    await route.fulfill({ status: 404, json: {} });
  });
  await page.route("**/api/checkout/quote", async (route) => {
    await route.fulfill({
      json: {
        contributionAmount: 350,
        feeAmount: 0,
        chargedAmount: 350,
        feeEnabled: false,
        provider: "demo",
        isDemo: true,
      },
    });
  });
  await page.route("**/api/orders**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ status: 405, json: { error: "read only" } });
      return;
    }
    await route.fulfill({
      json: {
        id: "order-flagship",
        eventId: "flagship-fixture-id",
        eventSlug: "flagship-fixture",
        guestName: "יעל כהן",
        totalAmount: 350,
        contributionAmount: 350,
        feeAmount: 0,
        chargedAmount: 350,
        paymentStatus: "paid",
        paymentProvider: "demo",
        paymentReference: "DEMO-FLAGSHIP",
        paidAt: "2026-10-28T09:00:00.000Z",
        accessToken: "11111111-1111-4111-8111-111111111111",
        items: [{ giftId: "gift-espresso", giftName: "מכונת אספרסו פרימיום", amount: 350 }],
      },
    });
  });
}

async function seedGuest(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "lolo-guest-amount:flagship-fixture",
      JSON.stringify({
        contributions: [
          { giftId: "gift-espresso", giftName: "מכונת אספרסו פרימיום", amount: 350 },
        ],
        amount: 350,
      }),
    );
    localStorage.setItem(
      "lolo-guest-order:flagship-fixture",
      JSON.stringify({
        id: "order-flagship",
        accessToken: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });
}

async function layoutReport(page: Page) {
  return page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    const small: string[] = [];
    for (const node of document.querySelectorAll("a, button, input, textarea, summary")) {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        continue;
      }
      const tag = node.tagName.toLowerCase();
      if ((tag === "input" || tag === "textarea") && node.closest("label")) {
        continue;
      }
      if (rect.width < 44 || rect.height < 44) {
        small.push(
          `${tag} ${(node.textContent || node.getAttribute("aria-label") || "").trim().slice(0, 40)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        );
      }
    }
    const shell = document.querySelector(".guest-shell");
    const stage = shell ? getComputedStyle(shell).backgroundColor : "";
    return { overflow: scrollWidth - clientWidth, small, stage };
  });
}

test("bold guest journey keeps contrast, frames, and a visible demo", async ({ page }) => {
  test.setTimeout(180_000);
  const failures: string[] = [];
  await seedGuest(page);
  await installReadRoutes(page, true);

  for (const width of widths) {
    await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
    for (const [name, pathName, heading] of screens) {
      await page.goto(pathName);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(page.locator("[data-journey]")).toBeVisible();
      const report = await layoutReport(page);
      if (report.overflow > 1) {
        failures.push(`${name} ${width} overflow ${report.overflow}`);
      }
      if (report.small.length) {
        failures.push(`${name} ${width} targets ${report.small.join("; ")}`);
      }
      if (report.stage !== "rgb(23, 47, 43)") {
        failures.push(`${name} ${width} stage ${report.stage}`);
      }

      if (name === "greeting" || name === "details") {
        if (await page.getByText("תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי").count()) {
          failures.push(`${name} ${width} shows a payment notice`);
        }
      }
      if (name === "payment" || name === "thanks") {
        await expect(page.getByText("תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי")).toBeVisible();
        const cardFields = await page
          .locator(
            "input[autocomplete='cc-number'], input[autocomplete='cc-exp'], input[autocomplete='cc-csc'], input[name*='card' i]",
          )
          .count();
        if (cardFields) failures.push(`${name} ${width} card fields ${cardFields}`);
        const brands = await page.getByText(/visa|mastercard|אמריקן אקספרס|ישראכרט/i).count();
        if (brands) failures.push(`${name} ${width} card brands`);
      }
      if (name === "details") {
        const updates = page.getByRole("checkbox", { name: /עדכון|דיוור|ניוזלטר/ });
        if (await updates.count()) {
          if (await updates.first().isChecked()) {
            failures.push(`${name} ${width} updates consent is pre-checked`);
          }
        }
        await expect(page.getByRole("checkbox", { name: "אני רוצה לקבל אישור על המתנה" })).toBeVisible();
      }
      if (name === "greeting" || name === "thanks") {
        await expect(page.locator("[data-journey-photo][data-image-source='host']:visible").first()).toBeVisible();
      }

      if ((width === 390 || width === 1440) && (name === "greeting" || name === "details" || name === "payment" || name === "thanks")) {
        const axe = await new AxeBuilder({ page }).include(".guest-shell").analyze();
        const serious = axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
        if (serious.length) {
          failures.push(
            `${name} ${width} axe ${serious.map((item) => `${item.id}:${item.nodes.length}`).join(", ")}`,
          );
        }
        await page.screenshot({
          path: path.join(artifactDir, `journey-after-${name}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }

  expect(failures, failures.join("\n")).toEqual([]);
});

test("library photos fill a guest journey when the host did not upload any", async ({ page }) => {
  test.setTimeout(60_000);
  await seedGuest(page);
  await installReadRoutes(page, false);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/e/flagship-fixture/greeting");
  await expect(page.getByRole("heading", { name: "מוסיפים ברכה אישית" })).toBeVisible();
  await expect(page.locator("[data-journey-photo][data-image-source='library']").first()).toBeVisible();
  await expect(page.locator("[data-illustrative-label]").first()).toHaveText("תמונה להמחשה");
  const sources = await page.locator("img").evaluateAll((images) =>
    images.map((image) => image.getAttribute("src") || ""),
  );
  expect(sources.join(" ")).not.toContain("__flagship_fixture");
  expect(sources.some((src) => src.includes("/images/library/"))).toBe(true);

  await page.goto("/e/flagship-fixture/thank-you");
  await expect(page.locator("[data-journey-photo][data-image-source='library']").first()).toBeVisible();
  await expect(page.locator("[data-journey-frame] [data-illustrative-label]")).toHaveText("תמונה להמחשה");
});
