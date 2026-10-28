import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

const artifactDir = process.env.FLAGSHIP_ARTIFACT_DIR || "/opt/cursor/artifacts";
const portraitPath = path.join(__dirname, "fixtures/flagship/portrait.jpg");
const giftPath = path.join(__dirname, "fixtures/flagship/gift.png");

const widths = [
  { name: "320", width: 320, height: 800 },
  { name: "360", width: 360, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 900 },
  { name: "1440", width: 1440, height: 900 },
] as const;

const reviewShots: Record<string, string> = {
  event: "01-gift",
};

function eventPayload() {
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
      coverImage: "/__flagship_fixture/portrait.jpg",
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
          imageUrl: "/__flagship_fixture/gift.png",
          source: "custom",
          priority: 0,
          active: true,
          storeId: null,
          storeName: "מעבדת הקפה",
        },
        {
          id: "gift-book",
          eventId: "flagship-fixture-id",
          title: "ספר מתכונים",
          description: "",
          targetAmount: 120,
          icon: "",
          imageUrl: "",
          source: "custom",
          priority: 1,
          active: true,
          storeId: null,
          storeName: "",
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

async function installReadRoutes(page: Page) {
  await page.route("**/api/events/flagship-fixture/funding", async (route) => {
    await route.fulfill({ json: fundingPayload });
  });
  await page.route("**/api/events/flagship-fixture", async (route) => {
    await route.fulfill({ json: eventPayload() });
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
  await page.route("**/api/orders**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: {} });
      return;
    }
    await route.fallback();
  });
}

async function expectNoOverflowAndLargeTargets(page: Page) {
  const report = await page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    const small: { tag: string; text: string; width: number; height: number }[] = [];
    for (const node of document.querySelectorAll("a, button, input, textarea, label")) {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        continue;
      }
      const tag = node.tagName.toLowerCase();
      if ((tag === "input" || tag === "textarea") && node.closest("label")) {
        continue;
      }
      if (rect.width < 44 || rect.height < 44) {
        small.push({
          tag,
          text: (node.textContent || node.getAttribute("aria-label") || "").trim().slice(0, 60),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }
    return { overflow: scrollWidth - clientWidth, small };
  });
  expect(report.overflow, JSON.stringify(report)).toBeLessThanOrEqual(1);
  expect(report.small, JSON.stringify(report.small)).toEqual([]);
}

const screens = [
  ["event", "/e/flagship-fixture", "מצטרפים למתנה"],
  ["greeting", "/e/flagship-fixture/greeting", "מוסיפים ברכה אישית"],
  ["details", "/e/flagship-fixture/details", "למי נגיד תודה?"],
  ["payment", "/e/flagship-fixture/payment", "כמעט סיימנו"],
  ["thanks", "/e/flagship-fixture/thank-you", "איזה כיף, השתתפת במתנה!"],
  ["missing", "/e/missing-demo-event", "האירוע לא נמצא"],
] as const;

for (const viewport of widths) {
  test(`guest screens stay in frame at ${viewport.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    await installReadRoutes(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [name, pathName, marker] of screens) {
      await page.goto(pathName);
      const markerLocator =
        name === "event"
          ? page.getByRole("button", { name: marker })
          : page.getByRole("heading", { name: marker, exact: true });
      await expect(markerLocator).toBeVisible();
      if (name === "greeting" || name === "details") {
        await expect(page.getByText("תשלום הדגמה — לא מתבצע חיוב אמיתי")).toHaveCount(0);
        await expect(page.getByText("תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי")).toHaveCount(0);
      }
      if (name === "payment" || name === "thanks") {
        await expect(page.getByText("תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי")).toBeVisible();
      }
      await expectNoOverflowAndLargeTargets(page);
      if (viewport.name === "390" || viewport.name === "1440") {
        await page.screenshot({
          path: path.join(artifactDir, `guest-live-${name}-${viewport.name}.png`),
          fullPage: true,
        });
        const shot = reviewShots[name];
        if (shot) {
          await page.screenshot({
            path: path.join(artifactDir, `${shot}-${viewport.name}.png`),
            fullPage: true,
          });
        }
      }
      if (
        (name === "greeting" || name === "details") &&
        (viewport.name === "390" || viewport.name === "768" || viewport.name === "1440")
      ) {
        await page.screenshot({
          path: path.join(artifactDir, `guest-review-${name}-${viewport.name}.png`),
          fullPage: true,
        });
      }
    }
  });
}

test("order post keeps greeting text and demo payment still confirms", async ({ page }) => {
  test.setTimeout(60_000);
  let orderPost: Record<string, unknown> | null = null;
  let order: Record<string, unknown> | null = null;
  let paid = false;
  let started = false;
  let confirmed = false;

  await installReadRoutes(page);
  await page.route("**/api/orders**", async (route: Route) => {
    if (route.request().method() === "POST") {
      orderPost = route.request().postDataJSON() as Record<string, unknown>;
      const body = orderPost;
      order = {
        id: "order-flagship",
        eventId: "flagship-fixture-id",
        eventSlug: "flagship-fixture",
        guestName: body.guestName || "",
        totalAmount: 350,
        contributionAmount: 350,
        feeAmount: 0,
        chargedAmount: 350,
        paymentStatus: "pending",
        paymentProvider: null,
        paymentReference: null,
        paidAt: null,
        accessToken: "token-flagship",
        greetingText: body.greetingText,
        items: [{ giftId: "gift-espresso", giftName: "מכונת אספרסו פרימיום", amount: 350 }],
      };
    }
    await route.fulfill({
      json: order
        ? {
            ...order,
            paymentStatus: paid ? "paid" : order.paymentStatus,
            paymentProvider: paid ? "demo" : order.paymentProvider,
          }
        : {},
    });
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
  await page.route("**/api/payments/start", async (route) => {
    started = true;
    await route.fulfill({
      json: {
        provider: "demo",
        isDemo: true,
        orderId: "order-flagship",
        status: "ready",
        contributionAmount: 350,
        feeAmount: 0,
        chargedAmount: 350,
      },
    });
  });
  await page.route("**/api/payments/confirm", async (route) => {
    confirmed = true;
    paid = true;
    await route.fulfill({
      json: {
        ...order,
        paymentStatus: "paid",
        paymentProvider: "demo",
        paymentReference: "DEMO-FLAGSHIP",
      },
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e/flagship-fixture");
  await expect(page.getByRole("heading", { name: "עוד מתנות" })).toBeVisible();
  await page.getByRole("button", { name: /350/ }).first().click();
  await page.getByRole("button", { name: "מצטרפים למתנה" }).click();
  await page.getByRole("button", { name: "אוהבים ושמחים לחגוג איתך." }).click();
  await page.getByRole("button", { name: /ממשיכים/ }).click();
  await page.getByLabel("שם מלא").fill("יעל כהן");
  await page.getByLabel("מספר טלפון").fill("0501234567");
  await page.getByLabel("אימייל").fill("yael@example.com");
  await page.getByRole("button", { name: "מעבר לתשלום" }).click();
  await expect(page.getByText("תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי")).toBeVisible();
  expect(orderPost?.greetingText).toBe("אוהבים ושמחים לחגוג איתך.");
  expect(orderPost).not.toHaveProperty("imageDataUrl");
  await page.getByRole("button", { name: "אישור תשלום הדגמה" }).click();
  await expect(page.locator("[data-order-status]")).toHaveText("שולם בהדגמה");
  expect(started).toBe(true);
  expect(confirmed).toBe(true);
});

test("filled guest screens at 390 and 1440", async ({ page }) => {
  test.setTimeout(90_000);
  await installReadRoutes(page);
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
  const paidOrder = {
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
  };
  await page.route("**/api/orders**", async (route) => {
    await route.fulfill({ json: paidOrder });
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "lolo-guest-order:flagship-fixture",
      JSON.stringify({
        id: "order-flagship",
        accessToken: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });
  for (const viewport of [
    { name: "390", width: 390, height: 844 },
    { name: "768", width: 768, height: 1024 },
    { name: "1440", width: 1440, height: 900 },
  ] as const) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/e/flagship-fixture");
    await page.getByRole("button", { name: /350/ }).first().click();
    await page.getByRole("button", { name: "מצטרפים למתנה" }).click();
    if (viewport.name === "390" || viewport.name === "768" || viewport.name === "1440") {
      await page.screenshot({
        path: path.join(artifactDir, `02-greeting-${viewport.name}.png`),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "אוהבים ושמחים לחגוג איתך." }).click();
    await page.getByRole("button", { name: /ממשיכים/ }).click();
    await page.getByLabel("שם מלא").fill("יעל כהן");
    await page.getByLabel("מספר טלפון").fill("0501234567");
    await page.getByLabel("אימייל").fill("yael@example.com");
    if (viewport.name === "390" || viewport.name === "1440") {
      await page.screenshot({
        path: path.join(artifactDir, `03-details-${viewport.name}.png`),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "מעבר לתשלום" }).click();
    await expect(page.getByText("תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי")).toBeVisible();
    if (viewport.name === "390" || viewport.name === "768" || viewport.name === "1440") {
      await page.screenshot({
        path: path.join(artifactDir, `04-payment-${viewport.name}.png`),
        fullPage: true,
      });
    }
    await page.goto("/e/flagship-fixture/thank-you");
    await expect(page.locator("[data-order-status]")).toHaveText("שולם בהדגמה");
    await expect(page.getByText("350").first()).toBeVisible();
    if (viewport.name === "390" || viewport.name === "768" || viewport.name === "1440") {
      await page.screenshot({
        path: path.join(artifactDir, `05-thanks-${viewport.name}.png`),
        fullPage: true,
      });
    }
  }
});

test("a gift without a photo uses the neutral fallback", async ({ page }) => {
  test.setTimeout(60_000);
  await installReadRoutes(page);
  await page.route("**/api/events/flagship-fixture", async (route) => {
    const body = eventPayload();
    body.event.coverImage = "";
    body.event.gifts[0].imageUrl = "";
    body.event.gifts[1].imageUrl = "";
    await route.fulfill({ json: body });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e/flagship-fixture");
  await expect(page.locator("[data-gift-fallback]").first()).toBeVisible();
  await expect(page.locator("[data-empty-letter]")).toHaveCount(0);
  await page.screenshot({
    path: path.join(artifactDir, "01-gift-nophoto-390.png"),
    fullPage: true,
  });
});

test("a long event title and gift name stay inside the frame", async ({ page }) => {
  test.setTimeout(60_000);
  await installReadRoutes(page);
  await page.route("**/api/events/flagship-fixture", async (route) => {
    const body = eventPayload();
    body.event.title = "חוגגים יום הולדת ארוך במיוחד לדנה וכל החברים שמגיעים מהצפון";
    body.event.gifts[0].title = "מכונת אספרסו מקצועית לבית עם מקציף חלב ומטחנת פולים מובנית";
    body.event.gifts[0].description =
      "תיאור ארוך שנשאר בתוך הכרטיס ולא דוחף את המסך לצדדים גם כשהמתנה מתוארת בכמה משפטים מלאים.";
    await route.fulfill({ json: body });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e/flagship-fixture");
  await expect(page.getByRole("heading", { name: /חוגגים יום הולדת ארוך/ })).toBeVisible();
  await expectNoOverflowAndLargeTargets(page);
  await page.screenshot({
    path: path.join(artifactDir, "01-gift-long-390.png"),
    fullPage: true,
  });
});
