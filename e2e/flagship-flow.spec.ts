import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

const artifactDir = process.env.FLAGSHIP_ARTIFACT_DIR || "/opt/cursor/artifacts";
const portraitPath = path.join(__dirname, "fixtures/flagship/portrait.jpg");
const giftPath = path.join(__dirname, "fixtures/flagship/gift.png");

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
      venueName: "תל אביב",
      address: "",
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

async function installFlow(page: Page) {
  let paid = false;
  let order: Record<string, unknown> | null = null;

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
  await page.route("**/api/checkout/quote", async (route) => {
    const body = route.request().postDataJSON() as { items?: { amount: number }[] };
    const contribution = (body.items ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
    await route.fulfill({
      json: {
        contributionAmount: contribution,
        feeAmount: 0,
        chargedAmount: contribution,
        feeEnabled: false,
        provider: "demo",
        isDemo: true,
      },
    });
  });
  await page.route("**/api/orders**", async (route) => {
    await fulfillOrder(route, () => order, (next) => {
      order = next;
    }, () => paid);
  });
  await page.route("**/api/payments/start", async (route) => {
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
    paid = true;
    if (order) {
      order = {
        ...order,
        paymentStatus: "paid",
        paymentProvider: "demo",
        paymentReference: "DEMO-FLAGSHIP",
      };
    }
    await route.fulfill({ json: order });
  });
}

async function fulfillOrder(
  route: Route,
  read: () => Record<string, unknown> | null,
  write: (order: Record<string, unknown>) => void,
  isPaid: () => boolean,
) {
  if (route.request().method() === "POST") {
    const body = route.request().postDataJSON() as {
      guestName?: string;
      items?: { giftId: string; amount: number }[];
    };
    const amount = (body.items ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
    write({
      id: "order-flagship",
      eventId: "flagship-fixture-id",
      eventSlug: "flagship-fixture",
      guestName: body.guestName || "",
      totalAmount: amount,
      contributionAmount: amount,
      feeAmount: 0,
      chargedAmount: amount,
      paymentStatus: "pending",
      paymentProvider: null,
      paymentReference: null,
      paidAt: null,
      accessToken: "token-flagship",
      items: (body.items ?? []).map((item) => ({
        giftId: item.giftId,
        giftName: "מכונת אספרסו פרימיום",
        amount: item.amount,
      })),
    });
  }
  const current = read();
  await route.fulfill({
    json: current
      ? {
          ...current,
          paymentStatus: isPaid() ? "paid" : current.paymentStatus,
          paymentProvider: isPaid() ? "demo" : current.paymentProvider,
          paymentReference: isPaid() ? "DEMO-FLAGSHIP" : current.paymentReference,
        }
      : {},
  });
}

for (const viewport of [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
] as const) {
  test(`guest flow ${viewport.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    await installFlow(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/e/flagship-fixture");
    await page.getByRole("button", { name: /350/ }).click();
    await page.getByRole("button", { name: "מצטרפים למתנה" }).click();
    await expect(page.getByRole("heading", { name: "משאירים ברכה" })).toBeVisible();
    await page.getByRole("button", { name: "אוהבים ושמחים לחגוג איתך." }).click();
    await page.screenshot({
      path: path.join(artifactDir, `flagship_greeting_${viewport.name}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: /ממשיכים/ }).click();

    await expect(page.getByRole("heading", { name: "עוד רגע מסיימים" })).toBeVisible();
    await page.getByLabel("שם מלא").fill("יעל כהן");
    await page.getByLabel("מספר טלפון").fill("0501234567");
    await page.getByLabel("אימייל").fill("yael@example.com");
    await page.screenshot({
      path: path.join(artifactDir, `flagship_details_${viewport.name}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "מעבר לתשלום" }).click();

    await expect(page.getByRole("heading", { name: "תשלום", exact: true })).toBeVisible();
    await expect(page.getByText("תשלום הדגמה — לא מתבצע חיוב אמיתי")).toBeVisible();
    await expect(page.getByText("זהו תשלום הדגמה. לא נגבה כסף אמיתי, ולא מתבקש מספר כרטיס אשראי.")).toBeVisible();
    const pay = page.getByRole("button", { name: "אישור תשלום הדגמה" });
    await expect(pay).toBeEnabled();
    await page.screenshot({
      path: path.join(artifactDir, `flagship_payment_${viewport.name}.png`),
      fullPage: true,
    });
    await pay.click();

    await expect(page.getByRole("heading", { name: "תודה" })).toBeVisible();
    await expect(page.locator("[data-reveal-card]")).toBeVisible();
    await expect(page.getByText("גרסת בטא — תשלומים מדומים בלבד")).toBeVisible();
    await expect(page.getByText("תשלום הדגמה", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "שיתוף האירוע" })).toBeVisible();
    await expect(page.getByText("כבר 23 חברים הצטרפו")).toBeVisible();
    await page.screenshot({
      path: path.join(artifactDir, `flagship_thanks_${viewport.name}.png`),
      fullPage: true,
    });
  });
}
