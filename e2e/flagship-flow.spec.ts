import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { BETA_CLARITY } from "@/app/design/beta-notice";
import { expectLetterClearOfBow } from "./empty-cover";

const artifactDir = process.env.FLAGSHIP_ARTIFACT_DIR || "/opt/cursor/artifacts";
const portraitPath = path.join(__dirname, "fixtures/flagship/portrait.jpg");
const giftPath = path.join(__dirname, "fixtures/flagship/gift.png");

function eventPayload(withImages = true) {
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

async function installFlow(page: Page, withImages = true) {
  let paid = false;
  let order: Record<string, unknown> | null = null;

  await page.route("**/api/events/flagship-fixture/funding", async (route) => {
    await route.fulfill({ json: fundingPayload });
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
    await expect(page.getByText("הזמנה אישית מאת נועה לוי")).toBeVisible();
    await expect(page.getByText("הזמנה מאת נועה לוי")).toHaveCount(0);
    await expect(page.getByText("הזמנה", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /350/ }).click();
    await page.getByRole("button", { name: "מצטרפים למתנה" }).click();
    await expect(page.getByRole("heading", { name: "משאירים ברכה" })).toBeVisible();
    await expect(page.locator("[data-continuity-title]")).toHaveText("חוגגים 40 לדנה");
    await expect(page.getByText("האירוע", { exact: true })).toHaveCount(0);
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
    await expect(page.getByText(BETA_CLARITY)).toHaveCount(1);
    if (viewport.name === "1440") {
      const hero = page.locator("[data-pay-hero]");
      await expect(hero.locator("[data-reveal-card]")).toHaveText("מכונת אספרסו פרימיום");
      await expect(hero.getByText("כבר 23 חברים הצטרפו")).toBeVisible();
      await expect(hero.locator("[data-gift-photo]")).toBeVisible();
    }
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
    await expect(page.getByText(BETA_CLARITY)).toHaveCount(1);
    await expect(page.getByText("גרסת בטא — תשלומים מדומים בלבד")).toHaveCount(0);
    await expect(page.getByText("תשלום הדגמה", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "שיתוף האירוע" })).toBeVisible();
    await expect(page.getByText("כבר 23 חברים הצטרפו")).toBeVisible();
    await expect(page.locator("[data-order-status]")).toHaveText("שולם בהדגמה");
    await expect(page.getByText("תשלום הדגמה — לא מתבצע חיוב אמיתי")).toBeVisible();
    await expect(page.locator("[data-reveal] [data-gift-photo]")).toBeVisible();
    await page.screenshot({
      path: path.join(artifactDir, `flagship_thanks_${viewport.name}.png`),
      fullPage: true,
    });

    await page.getByRole("link", { name: "חזרה לאירוע" }).click();
    await expect(page.getByText("עדיין לא נבחרה מתנה")).toBeVisible();
    await expect(page.getByRole("button", { name: /350/ })).toHaveAttribute("aria-pressed", "false");
  });
}

for (const viewport of [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
] as const) {
  test(`guest flow without images ${viewport.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    await installFlow(page, false);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/e/flagship-fixture");
    await expectLetterClearOfBow(page);
    await page.getByRole("button", { name: /350/ }).click();
    await page.getByRole("button", { name: "מצטרפים למתנה" }).click();
    await expect(page.locator("[data-continuity-title]")).toHaveText("חוגגים 40 לדנה");
    await expect(page.locator("[data-continuity-letter]")).toHaveText("ח");
    await page.getByRole("button", { name: /ממשיכים/ }).click();
    await page.getByLabel("שם מלא").fill("יעל כהן");
    await page.getByLabel("מספר טלפון").fill("0501234567");
    await page.getByLabel("אימייל").fill("yael@example.com");
    await page.getByRole("button", { name: "מעבר לתשלום" }).click();
    if (viewport.name === "1440") {
      await expect(page.locator("[data-pay-hero] [data-parcel]")).toBeVisible();
      await expect(page.locator("[data-pay-hero] [data-gift-photo]")).toHaveCount(0);
    }
    await page.getByRole("button", { name: "אישור תשלום הדגמה" }).click();
    await expect(page.getByRole("heading", { name: "תודה" })).toBeVisible();
    await expectLetterClearOfBow(page);
    await expect(page.getByText(BETA_CLARITY)).toHaveCount(1);
    await expect(page.locator("[data-reveal] [data-parcel]")).toBeVisible();
    await expect(page.locator("[data-reveal] [data-gift-photo]")).toHaveCount(0);
    await expect(page.getByText("כבר 23 חברים הצטרפו")).toBeVisible();
    await expect(page.locator("[data-order-status]")).toHaveText("שולם בהדגמה");
    await page.screenshot({
      path: path.join(artifactDir, `flagship_thanks_${viewport.name}_without_images.png`),
      fullPage: true,
    });
  });
}

test("thank-you shows an error when the order read fails", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "lolo-guest-order:flagship-fixture",
      JSON.stringify({ id: "order-flagship", accessToken: "token-flagship" }),
    );
  });
  await page.route("**/api/events/flagship-fixture/funding", async (route) => {
    await route.fulfill({ json: fundingPayload });
  });
  await page.route("**/api/events/flagship-fixture", async (route) => {
    await route.fulfill({ json: eventPayload(false) });
  });
  await page.route("**/api/orders**", async (route) => {
    await route.fulfill({ status: 500, json: { error: "טעינת ההזמנה נכשלה." } });
  });
  await page.goto("/e/flagship-fixture/thank-you");
  await expect(page.locator("[data-order-status]")).toHaveText(
    "לא הצלחנו לקרוא את סטטוס התשלום מהשרת.",
  );
  await expect(page.getByText("שולם בהדגמה")).toHaveCount(0);
  await expect(page.getByText("התשלום התקבל")).toHaveCount(0);
  await expect(page.getByText("תשלום הדגמה — לא מתבצע חיוב אמיתי")).toBeVisible();
  await expect(page.getByText(BETA_CLARITY)).toHaveCount(1);
  await expect(page.getByText("גרסת בטא — תשלומים מדומים בלבד")).toHaveCount(0);
});

for (const viewport of [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
] as const) {
  test(`demo showcase ${viewport.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/e/demo-event");
    await expect(page.getByRole("heading", { name: /חוגגים 40 לדנה/ })).toBeVisible();
    await expect(page.getByText("אירוע הדגמה — נתונים לדוגמה").first()).toBeVisible();
    await expect(page.getByText("Pexels License")).toBeVisible();
    await expect(page.getByText("כבר 18 חברים הצטרפו")).toBeVisible();
    await page.screenshot({
      path: path.join(artifactDir, `flagship_demo_guest_${viewport.name}.png`),
      fullPage: true,
    });

    await page.getByRole("button", { name: /350/ }).click();
    await page.getByRole("button", { name: "מצטרפים למתנה" }).click();
    await expect(page.locator("[data-continuity-title]")).toHaveText(
      "חוגגים 40 לדנה — מתנה מכל החברים",
    );
    await page.screenshot({
      path: path.join(artifactDir, `flagship_demo_greeting_${viewport.name}.png`),
      fullPage: true,
    });

    await page.getByRole("button", { name: /ממשיכים/ }).click();
    await page.getByLabel("שם מלא").fill("יעל כהן");
    await page.getByLabel("מספר טלפון").fill("0501234567");
    await page.getByLabel("אימייל").fill("yael@example.com");
    await page.getByRole("button", { name: "מעבר לתשלום" }).click();
    await expect(page.getByRole("heading", { name: "תשלום", exact: true })).toBeVisible();
    await expect(page.getByText("תשלום הדגמה — לא מתבצע חיוב אמיתי")).toBeVisible();
    await expect(page.getByText(BETA_CLARITY)).toHaveCount(1);
    await page.screenshot({
      path: path.join(artifactDir, `flagship_demo_payment_${viewport.name}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "אישור תשלום הדגמה" }).click();
    await expect(page.getByText("תשלום הדגמה זמין באירוע שפורסם.")).toBeVisible();

    await page.goto("/e/demo-event/thank-you");
    await expect(page.locator("[data-order-status]")).toHaveText("עדיין אין אישור תשלום מהשרת.");
    await expect(page.getByText("שולם בהדגמה")).toHaveCount(0);
    await expect(page.getByText("כבר 18 חברים הצטרפו")).toBeVisible();
    await expect(page.getByText("אירוע הדגמה — נתונים לדוגמה").first()).toBeVisible();
    await expect(page.getByText("תשלום הדגמה — לא מתבצע חיוב אמיתי")).toBeVisible();
    await expect(page.getByText(BETA_CLARITY)).toHaveCount(1);
    await page.screenshot({
      path: path.join(artifactDir, `flagship_demo_thanks_${viewport.name}.png`),
      fullPage: true,
    });
  });
}
