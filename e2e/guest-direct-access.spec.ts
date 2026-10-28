import { expect, test, type Page, type Route } from "@playwright/test";
import { GUEST_EVENT_FIELDS } from "@/lib/events/guest-shape";
import { PUBLIC_FUNDING_GIFT_KEYS, PUBLIC_GIFT_KEYS, PUBLIC_QUOTE_KEYS } from "@/lib/events/public-guest";

const gatedOrigin = "http://127.0.0.1:3001";

test.use({ baseURL: gatedOrigin });
test.describe.configure({ mode: "serial" });

function eventPayload() {
  return {
    event: {
      id: "flagship-fixture-id",
      slug: "birthday-ab12",
      title: "יום הולדת ליעל",
      hostName: "נועה לוי",
      eventType: "יום הולדת",
      date: "2026-11-06",
      time: "19:00",
      venueName: "תל אביב",
      address: "",
      message: "בואו לחגוג.",
      coverImage: "",
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
          imageUrl: "",
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

async function installFlow(page: Page) {
  let paid = false;
  let order: Record<string, unknown> | null = null;

  await page.route("**/api/events/birthday-ab12/funding", async (route) => {
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
  await page.route("**/api/events/birthday-ab12", async (route) => {
    await route.fulfill({ json: eventPayload() });
  });
  await page.route("**/api/invite/identity**", async (route) => {
    await route.fulfill({ json: { name: "", phone: "" } });
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
      order = { ...order, paymentStatus: "paid", paymentProvider: "demo" };
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
      eventSlug: "birthday-ab12",
      guestName: body.guestName || "",
      totalAmount: amount,
      contributionAmount: amount,
      feeAmount: 0,
      chargedAmount: amount,
      paymentStatus: "pending",
      paymentProvider: null,
      paymentReference: null,
      paidAt: null,
      accessToken: "11111111-1111-4111-8111-111111111111",
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
      ? { ...current, paymentStatus: isPaid() ? "paid" : current.paymentStatus }
      : {},
  });
}

async function expectBetaWall(status: number, location: string | undefined) {
  expect([301, 302, 303, 307, 308]).toContain(status);
  expect(location ?? "").toContain("/beta");
}

test("an old slug still opens and a guest can finish demo payment without a beta cookie", async ({ page }) => {
  test.setTimeout(60_000);
  await installFlow(page);
  await page.goto("/e/birthday-ab12");
  await expect(page).toHaveURL(/\/e\/birthday-ab12$/);
  await expect(page.getByRole("heading", { name: /יום הולדת ליעל/ })).toBeVisible();
  const names = (await page.context().cookies()).map((cookie) => cookie.name);
  expect(names).not.toContain("lolo_beta_session");

  await page.getByRole("button", { name: /350/ }).click();
  await page.getByRole("button", { name: "מצטרפים למתנה" }).click();
  await expect(page).toHaveURL(/\/greeting/);
  await page.getByRole("button", { name: "אוהבים ושמחים לחגוג איתך." }).click();
  await page.getByRole("button", { name: /ממשיכים/ }).click();
  await page.getByLabel("שם מלא").fill("יעל כהן");
  await page.getByLabel("מספר טלפון").fill("0501234567");
  await page.getByLabel("אימייל").fill("yael@example.com");
  await page.getByRole("button", { name: "מעבר לתשלום" }).click();
  await expect(page.getByRole("heading", { name: "כמעט סיימנו", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "אישור תשלום הדגמה" }).click();
  await expect(page.getByRole("heading", { name: "איזה כיף, השתתפת במתנה!" })).toBeVisible();
  await expect(page).toHaveURL(/\/thank-you/);
});

test("guest reads stay public and every other surface stays gated", async ({ request }) => {
  const event = await request.get("/api/events/demo-event");
  expect(event.status()).toBe(200);
  const eventBody = (await event.json()) as { event: Record<string, unknown> & { gifts: Record<string, unknown>[] } };
  expect(Object.keys(eventBody.event).sort()).toEqual([...GUEST_EVENT_FIELDS].sort());
  expect(Object.keys(eventBody.event.gifts[0] ?? {}).sort()).toEqual([...PUBLIC_GIFT_KEYS].sort());
  expect(JSON.stringify(eventBody)).not.toContain("accessCode");

  const funding = await request.get("/api/events/demo-event/funding");
  expect(funding.status()).toBe(200);
  const fundingBody = (await funding.json()) as { gifts: Record<string, unknown>[] };
  expect(Object.keys(fundingBody)).toEqual(["gifts"]);
  expect(Object.keys(fundingBody.gifts[0] ?? {}).sort()).toEqual([...PUBLIC_FUNDING_GIFT_KEYS].sort());

  const quote = await request.post("/api/checkout/quote", {
    data: { slug: "demo-event", items: [{ giftId: "demo-espresso", amount: 200 }] },
  });
  expect(quote.status()).toBe(200);
  expect(Object.keys(await quote.json()).sort()).toEqual([...PUBLIC_QUOTE_KEYS].sort());

  const identity = await request.get("/api/invite/identity?slug=demo-event");
  expect(identity.status()).toBe(200);
  expect(Object.keys(await identity.json()).sort()).toEqual(["name", "phone"]);

  const order = await request.post("/api/orders", {
    data: {
      slug: "not a slug",
      guestName: "א",
      guestPhone: "0501234567",
      guestEmail: "a@example.com",
      items: [{ giftId: "x", amount: 10 }],
    },
  });
  expect(order.status()).not.toBe(401);

  const capped = await request.post("/api/orders", {
    data: {
      slug: "demo-event",
      guestName: "יעל",
      guestPhone: "0501234567",
      guestEmail: "yael@example.com",
      items: [{ giftId: "demo-espresso", amount: 100_001 }],
    },
  });
  expect(capped.status()).toBe(400);

  const page = await request.get("/e/demo-event", { maxRedirects: 0 });
  expect(page.status()).toBe(200);
  expect(page.headers()["x-robots-tag"] ?? "").toContain("noindex");

  const freshSlug = await request.get("/e/event-abcdefghij", { maxRedirects: 0 });
  expect(freshSlug.status()).toBe(200);

  const invite = await request.get(`/i/${"a".repeat(43)}`, { maxRedirects: 0 });
  expect(invite.status()).not.toBe(401);
  expect(invite.headers().location ?? "").not.toContain("/beta");
  expect(invite.headers()["x-robots-tag"] ?? "").toContain("noindex");
  expect(await invite.text()).toContain("noindex");

  const walls: Array<[string, string]> = [
    ["GET", "/"],
    ["GET", "/create-event"],
    ["GET", "/host"],
    ["GET", "/admin"],
    ["GET", "/store"],
    ["GET", "/v/example-token"],
    ["GET", "/e/demo-event/extra"],
  ];
  for (const [method, path] of walls) {
    const response = await request.fetch(path, { method, maxRedirects: 0 });
    await expectBetaWall(response.status(), response.headers().location);
  }

  const apis: Array<[string, string]> = [
    ["POST", "/api/events"],
    ["POST", "/api/uploads/images"],
    ["POST", "/api/host/login"],
    ["POST", "/api/admin/login"],
    ["POST", "/api/store/login"],
    ["GET", "/api/stores"],
    ["POST", "/api/events/demo-event"],
    ["GET", "/api/payments/confirm"],
  ];
  for (const [method, path] of apis) {
    const response = await request.fetch(path, { method, maxRedirects: 0 });
    expect(response.status(), `${method} ${path}`).toBe(401);
  }
});

test("repeated event reads from one address return 429", async ({ request }) => {
  let blocked = false;
  for (let count = 0; count < 70; count += 1) {
    const response = await request.get("/api/events/demo-event");
    if (response.status() === 429) {
      blocked = true;
      expect(response.headers()["retry-after"]).toBeTruthy();
      break;
    }
    expect(response.status()).toBe(200);
  }
  expect(blocked).toBe(true);
});
