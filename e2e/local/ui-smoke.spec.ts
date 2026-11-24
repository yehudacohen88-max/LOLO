import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const shotDir = path.join(process.cwd(), "docs/system/local-ui-screenshots");
const adminPassword = process.env.LOLO_ADMIN_PASSWORD || "local-demo-admin";
const demoSlug = "demo-bat-mitzvah-noa";

test.beforeAll(() => {
  fs.mkdirSync(shotDir, { recursive: true });
});

async function capture(page: Page, name: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: path.join(shotDir, `${name}-desktop.png`),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(shotDir, `${name}-mobile.png`),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
}

async function loginHost(page: Page, slug: string, code: string) {
  await page.goto("/host");
  await page.getByLabel("קישור האירוע או כתובת עמוד האורחים").fill(slug);
  await page.getByLabel("קוד ניהול פרטי").fill(code);
  await page.getByRole("button", { name: "כניסה" }).click();
  await expect(page).toHaveURL(/\/host\/events\/[0-9a-f-]+$/);
}

async function loginAdmin(page: Page) {
  await page.goto("/admin");
  const dashboard = page.getByRole("heading", { name: "לוח בקרה" });
  const password = page.getByLabel("קוד ניהול");
  await expect(dashboard.or(password)).toBeVisible();
  if (await password.isVisible()) {
    await password.fill(adminPassword);
    await page.getByRole("button", { name: "כניסה" }).click();
  }
  await expect(dashboard).toBeVisible();
}

async function ensureDemoStoreActive(page: Page) {
  await loginAdmin(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/stores");
  const demoStore = page.getByRole("row").filter({ hasText: "אופנים — הדגמה" });
  await expect(demoStore).toBeVisible();
  const activate = demoStore.getByRole("button", { name: "הפעלה" });
  if (await activate.isVisible()) {
    await activate.click();
  }
  await expect(demoStore.getByRole("button", { name: "השבתה" })).toBeVisible();
}

test("home, headers, and host create publish a local event", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const headers = response?.headers() ?? {};
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=(self)");
  await expect(page.getByRole("heading", { name: "המתנה שבאמת רציתם, ביחד." })).toBeVisible();
  await capture(page, "home");

  await page.goto("/create-event?new=1");
  await expect(page.getByRole("heading", { name: "בואו ניצור את האירוע שלכם" })).toBeVisible();
  await page.getByRole("button", { name: "יום הולדת" }).click();
  await page.getByLabel("שם האירוע").fill("אירוע מקומי נתונים לדוגמה");
  await page.getByLabel("מתי חוגגים?").fill("2026-12-01");
  await page.getByLabel("שם בעל/ת האירוע").fill("משפחת הדגמה");
  await capture(page, "host-create");
  await page.getByRole("button", { name: "ממשיכים לבחירת המתנות" }).click();
  await page.getByRole("button", { name: /מתנה כספית/ }).click();
  await page.getByRole("button", { name: "ממשיכים", exact: true }).click();
  await page.waitForURL("**/create-event/gifts/money");
  await page.locator("main").getByRole("button", { name: "ממשיכים", exact: true }).click();
  await page.waitForURL("**/create-event/details");
  await page.getByLabel("כמה מילים לאורחים").fill("נתונים לדוגמה. אין כאן חיוב אמיתי.");
  await page.getByLabel("שם המקום / האולם").fill("אולם מקומי");
  await page.getByLabel("כתובת").fill("רחוב הדגמה 2");
  await page.getByLabel("שעת האירוע").fill("18:00");
  await page.getByRole("button", { name: "ממשיכים להזמנת האורחים" }).click();
  await page.getByLabel("שם האורח").fill("אורח הדגמה");
  await page.getByLabel("מספר טלפון").fill("0500002200");
  await page.getByRole("button", { name: "הוספה לרשימה" }).click();
  await expect(page.getByText("נוספו 1 אורחים")).toBeVisible();
  await page.getByRole("button", { name: "תצוגה מקדימה של האירוע" }).click();
  await page.getByRole("button", { name: "יצירת האירוע" }).click();
  await expect(page.getByText("קוד ניהול פרטי לאירוע")).toBeVisible();
  const ltr = page.locator("p[dir='ltr']");
  const code = (await ltr.nth(0).innerText()).trim();
  const guestUrl = (await ltr.nth(1).innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  expect(guestUrl).toMatch(/\/e\//);
  await capture(page, "host-create-success");

  await loginHost(page, guestUrl, code);
  await expect(page.getByRole("heading", { name: "אירוע מקומי נתונים לדוגמה" })).toBeVisible();
});

test("guest demo checkout reaches a server paid status", async ({ page }) => {
  await page.goto(`/e/${demoSlug}`);
  await expect(page.getByRole("heading", { name: "בת המצווה של נועה" })).toBeVisible();
  await expect(page.getByText("נתונים לדוגמה").first()).toBeVisible();
  await expect(page.getByText("תשלום הדגמה — לא מתבצע חיוב אמיתי")).toBeVisible();
  await capture(page, "guest-event");
  await page.getByRole("button", { name: "סכום אחר" }).first().click();
  await page.getByLabel("הזינו סכום").first().fill("100");
  await page.getByRole("button", { name: /מצטרפים למתנה/ }).click();
  await expect(page).toHaveURL(/\/greeting/);
  await capture(page, "guest-greeting");
  const skip = page.getByRole("button", { name: "בלי ברכה" });
  if (await skip.isVisible()) {
    await skip.click();
  } else {
    await page.getByRole("button", { name: /ממשיכים/ }).click();
  }
  await expect(page).toHaveURL(/\/details/);
  await page.getByLabel("שם מלא").fill("אורח מקומי");
  await page.getByLabel("מספר טלפון").fill("0500002201");
  await page.getByLabel("אימייל").fill("local-guest@example.com");
  await capture(page, "guest-details");
  await page.getByRole("button", { name: "מעבר לתשלום" }).click();
  await expect(page).toHaveURL(/\/payment/);
  await expect(page.getByText("תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי")).toBeVisible();
  await capture(page, "guest-payment");
  await page.getByRole("button", { name: "אישור תשלום הדגמה" }).click();
  await expect(page).toHaveURL(/\/thank-you/, { timeout: 30_000 });
  await expect(page.getByText("שולם בהדגמה")).toBeVisible();
  await expect(page.getByText("תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי")).toBeVisible();
  await capture(page, "guest-thank-you");
});

test("host dashboard, edit, my events, and simulated recovery", async ({ page }) => {
  await loginHost(page, demoSlug, "DEMO-LOLO");
  await expect(page.getByRole("heading", { name: "בת המצווה של נועה" })).toBeVisible();
  await capture(page, "host-dashboard");
  await page.getByLabel("מקום").fill("אולם הדגמה מעודכן");
  await page.getByRole("button", { name: "שמירת שינויים" }).click();
  await expect(page.getByText("האירוע עודכן. קישור האורחים לא השתנה.")).toBeVisible();

  await page.getByLabel("אימייל לשחזור ולרשימה").fill("host-demo@example.com");
  await page.getByRole("button", { name: "קישור האירוע" }).click();
  await expect(page.getByText("האירוע קושר לאימייל. אפשר לראות אותו ברשימה.")).toBeVisible();
  await page.goto("/host/events");
  await expect(page.getByRole("heading", { name: "האירועים שלי" })).toBeVisible();
  await expect(page.getByText("בת המצווה של נועה")).toBeVisible();
  await capture(page, "host-my-events");

  await page.goto("/host/recovery");
  await expect(page.getByRole("heading", { name: /שחזור/ })).toBeVisible();
  await page.getByLabel("קישור האירוע").fill(demoSlug);
  await page.getByLabel("אימייל השחזור").fill("host-demo@example.com");
  await capture(page, "host-recovery");
  await page.getByRole("button", { name: "בקשת קוד חד-פעמי" }).click();
  await expect(page.getByText("ספק ההודעות המדומה")).toBeVisible();
  const outbox = await page.request.get("/api/host/recovery/local-outbox");
  expect(outbox.status()).toBe(200);
  const payload = (await outbox.json()) as { notices?: { body: string; simulated: boolean; delivered: boolean }[] };
  const notice = payload.notices?.find((item) => item.body.includes("קוד חד-פעמי"));
  expect(notice?.simulated).toBe(true);
  expect(notice?.delivered).toBe(false);
  const otp = notice?.body.match(/\d{6}/)?.[0] ?? "";
  expect(otp).toMatch(/^\d{6}$/);
  await page.getByLabel("קוד חד-פעמי").fill(otp);
  await page.getByRole("button", { name: "אימות והנפקת קוד חדש" }).click();
  await expect(page.locator("[data-new-access-code]")).toBeVisible();
  await capture(page, "host-recovery-code");
});

test("admin lists, settlement, audit, notifications, and documents", async ({ page }) => {
  await loginAdmin(page);
  await capture(page, "admin-home");

  const pages: { href: string; heading: string; shot?: string }[] = [
    { href: "/admin/stores", heading: "בתי עסק", shot: "admin-stores" },
    { href: "/admin/events", heading: "אירועים ומארחים", shot: "admin-events" },
    { href: "/admin/orders", heading: "הזמנות", shot: "admin-orders" },
    { href: "/admin/guests", heading: "אורחים", shot: "admin-guests" },
    { href: "/admin/payments", heading: "תשלומים" },
    { href: "/admin/refunds", heading: "ביטולים והחזרים" },
    { href: "/admin/vouchers", heading: "שוברים" },
    { href: "/admin/redemptions", heading: "מימושים" },
    { href: "/admin/reports", heading: "דוחות" },
    { href: "/admin/audit", heading: "יומן פעולות", shot: "admin-audit" },
    { href: "/admin/settlements", heading: "התחשבנויות", shot: "admin-settlements" },
    { href: "/admin/settings", heading: "הגדרות" },
    { href: "/admin/notifications", heading: "הודעות ומסמכים", shot: "admin-notifications" },
  ];

  for (const entry of pages) {
    const response = await page.goto(entry.href);
    expect(response?.status(), entry.href).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: entry.heading, level: 1 })).toBeVisible();
    if (entry.shot) {
      await capture(page, entry.shot);
    }
  }

  await expect(page.getByText("לא נשלחת הודעה אמיתית")).toBeVisible();
  await expect(page.getByRole("heading", { name: "מסמכים", exact: true })).toBeVisible();

  await ensureDemoStoreActive(page);
});

test("store desk refuses to redeem a demo voucher", async ({ page }) => {
  await ensureDemoStoreActive(page);
  await page.goto("/store");
  await page.getByLabel("שם הכניסה של החנות").fill("demo-ofanaim");
  await page.getByLabel("קוד כניסה").fill("DEMO-SHOP-CODE");
  await page.getByRole("button", { name: "כניסה" }).click();
  await expect(page).toHaveURL(/\/store\/redeem/);
  await expect(page.getByRole("heading", { name: "מימוש שובר" })).toBeVisible();
  await capture(page, "store-redeem");

  await page.getByLabel("קוד השובר").fill("DEMO-SHOW-CARD-0002");
  await page.getByRole("button", { name: "בדיקת שובר" }).click();
  await expect(page.getByText("שובר הדגמה – ללא ערך כספי")).toBeVisible();
  await expect(page.getByText("אי אפשר להנפיק או לממש אותו ככסף.")).toBeVisible();
  await expect(page.getByRole("button", { name: "אישור מימוש" })).toHaveCount(0);
  await expect(page.getByText("המימוש נקלט")).toHaveCount(0);
  await capture(page, "store-demo-refused");

  for (const entry of [
    { href: "/store/transactions", heading: "היסטוריית מימושים" },
    { href: "/store/balance", heading: "יתרה לתשלום" },
    { href: "/store/business", heading: "פרטי בית העסק" },
    { href: "/store/settlements", heading: "התחשבנויות" },
  ]) {
    const response = await page.goto(entry.href);
    expect(response?.status(), entry.href).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: entry.heading })).toBeVisible();
  }
  await capture(page, "store-history");
});
