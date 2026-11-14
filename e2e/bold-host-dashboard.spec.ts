import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { BETA_CLARITY } from "@/app/design/beta-notice";

const ARTIFACTS = "/opt/cursor/artifacts/host-final";
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440] as const;
const EVENT_A = "11111111-1111-4111-8111-111111111111";
const EVENT_B = "22222222-2222-4222-8222-222222222222";
const GUEST_B = "33333333-3333-4333-8333-333333333333";
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABLAAEBAAAAAAAAAAAAAAAAAAAABgEBAAAAAAAAAAAAAAAAAAAABhABAAAAAAAAAAAAAAAAAAAAABEBAAAAAAAAAAAAAAAAAAAAAP/AABEIAAgACAMBIgACEQADEQD/2gAMAwEAAhEDEQA/ALcApHn/2Q==",
  "base64",
);

function shot(page: Page, name: string) {
  mkdirSync(ARTIFACTS, { recursive: true });
  return page.screenshot({ path: `${ARTIFACTS}/${name}.png`, fullPage: true });
}

function shotLocator(page: Page, selector: string, name: string) {
  mkdirSync(ARTIFACTS, { recursive: true });
  return page.locator(selector).screenshot({ path: `${ARTIFACTS}/${name}.png` });
}

async function overflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function seriousAxe(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  return axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
}

test.describe("bold host dashboard", () => {
  test.describe.configure({ timeout: 120_000 });

  test("host login keeps labels, focus, and the session gate", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/host");
    await expect(page.getByRole("heading", { name: "כניסה לניהול האירוע" })).toBeVisible();
    await expect(page.getByText("קישור האירוע או קוד הניהול שגויים.")).toHaveCount(0);
    await shot(page, "host-login-clean-390");
    await page.setViewportSize({ width: 1440, height: 900 });
    await shot(page, "host-login-clean-1440");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const stage = await page.evaluate(
      () => getComputedStyle(document.querySelector("[data-bold-host]")!).backgroundColor,
    );
    expect(stage).toBe("rgb(23, 47, 43)");

    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement!);
      return { outline: style.outlineStyle, width: style.outlineWidth };
    });
    expect(focus.outline).not.toBe("none");
    expect(Number.parseFloat(focus.width)).toBeGreaterThan(0);

    await page.route("**/api/host/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "קישור האירוע או קוד הניהול שגויים." }),
      });
    });
    await page.getByLabel("קישור האירוע או כתובת עמוד האורחים").fill("event-host-demo");
    await page.getByLabel("קוד ניהול פרטי").fill("ZZZZ-ZZZZ");
    await page.getByRole("button", { name: "כניסה" }).click();
    await expect(page.getByText("קישור האירוע או קוד הניהול שגויים.")).toBeVisible();
    await shot(page, "host-login-error-390");

    await page.setViewportSize({ width: 1440, height: 900 });
    await shot(page, "host-login-error-1440");

    await page.unroute("**/api/host/login");
    await page.route("**/api/host/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ eventId: EVENT_A }),
      });
    });
    const opened = page.waitForRequest((request) =>
      request.url().includes(`/host/events/${EVENT_A}`),
    );
    await page.getByRole("button", { name: "כניסה" }).click();
    await opened;
    await expect(page).toHaveURL(/\/host$/);
  });

  test("the sample dashboard shows gifts, participations, hidden amounts, and empty copy", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/host/example?view=live");
    await expect(page.getByRole("heading", { name: "יום ההולדת של יובל" })).toBeVisible();
    await expect(page.getByText("נתוני דוגמה — לא אירוע אמיתי")).toBeVisible();
    await expect(page.getByText(BETA_CLARITY)).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "מכונת אספרסו" })).toBeVisible();
    await expect(page.getByText("השתתפות פתוחה")).toBeVisible();
    await expect(page.locator("[data-gift-target='hidden']")).toContainText("בלי יעד מוצג לאורחים");
    await expect(page.getByText("יוסי לוי")).toBeVisible();
    await expect(page.getByText("מיכל אברהם")).toBeVisible();
    await expect(page.getByText("נועם לוי")).toBeVisible();
    await expect(page.getByText("ממתין לתשלום").first()).toBeVisible();
    await expect(page.getByText("שולם").first()).toBeVisible();
    await expect(page.getByText("הצעד הבא: הציגו את הכרטיס בחנות")).toBeVisible();
    await expect(page.getByText("שובר הדגמה בלבד")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "הנפקת שובר" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "העתקת קישור" })).toBeEnabled();
    await expect(page.getByRole("link", { name: "שיתוף ב-WhatsApp" })).toHaveAttribute(
      "href",
      /api\.whatsapp\.com/,
    );
    const frame = await page.locator("[data-host-dashboard]").boundingBox();
    expect(frame?.width ?? 9999).toBeLessThanOrEqual(1160);
    expect(frame?.x ?? 0).toBeGreaterThan(8);

    await shotLocator(page, "[data-host-shot='top']", "host-overview-390");
    await shotLocator(page, "[data-host-shot='finance']", "host-finance-390");
    await shotLocator(page, "[data-host-shot='gifts']", "host-gifts-390");
    await shotLocator(page, "[data-host-shot='orders']", "host-participations-390");
    await shotLocator(page, "[data-host-shot='guests']", "host-guests-390");

    await page.setViewportSize({ width: 1440, height: 900 });
    const wide = await page.locator("[data-host-dashboard]").boundingBox();
    expect(wide?.width ?? 9999).toBeLessThanOrEqual(1160);
    expect(wide?.x ?? 0).toBeGreaterThan(40);
    await shotLocator(page, "[data-host-shot='top']", "host-overview-1440");
    await shotLocator(page, "[data-host-shot='finance']", "host-finance-1440");
    await shotLocator(page, "[data-host-shot='gifts']", "host-gifts-1440");
    await shotLocator(page, "[data-host-shot='orders']", "host-participations-1440");
    await shotLocator(page, "[data-host-shot='guests']", "host-guests-1440");
  });

  test("share, copy, and adding a guest work against a mocked host API", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 390, height: 844 });
    let posted: { name?: string; phone?: string } | null = null;
    await page.route("**/api/host/events/**/guests", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "אין הרשאה." }),
        });
        return;
      }
      posted = route.request().postDataJSON() as { name?: string; phone?: string };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          guest: {
            id: "00000000-0000-4000-8000-0000000000a9",
            eventId: "00000000-0000-4000-8000-0000000000e1",
            name: posted.name,
            phone: posted.phone,
            createdAt: "2026-11-14T12:00:00.000Z",
            invitePath: "/i/example-yael",
          },
        }),
      });
    });

    await page.goto("/host/example?view=live");
    await expect(page.getByText("בדוגמה זו הפעולות מושבתות")).toHaveCount(0);
    await page.getByRole("button", { name: "העתקת קישור" }).click();
    await expect(page.getByText("הקישור הועתק")).toBeVisible();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(
      "https://lolo.example/e/event-example",
    );
    const whatsapp = page.getByRole("link", { name: "שלח ב-WhatsApp" });
    await expect(whatsapp).toHaveAttribute("href", /api\.whatsapp\.com/);
    await expect(page.getByRole("link", { name: "שיתוף ב-WhatsApp" })).toBeVisible();

    await page.getByLabel("שם האורח").fill("יעל מזרחי");
    await page.getByLabel("מספר טלפון").fill("0509876543");
    await page.getByRole("button", { name: "הוספת אורח" }).click();
    await expect(page.getByText("יעל מזרחי")).toBeVisible();
    expect(posted).toEqual({ name: "יעל מזרחי", phone: "0509876543" });
    await expect(page.getByLabel("שם האורח")).toHaveValue("");
  });

  test("a host can replace a cover and return to the library photo", async ({ page }) => {
    for (const width of [390, 1440] as const) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
      await page.goto("/host/example?view=live");
      const overview = page.locator("section").filter({
        has: page.getByRole("heading", { name: "סקירת האירוע" }),
      });
      await expect(overview.locator("[data-image-source='library']")).toHaveAttribute(
        "src",
        /candle-layer-cake-hero\.webp/,
      );
      await overview.locator('input[type="file"]').setInputFiles({
        name: "cover.jpg",
        mimeType: "image/jpeg",
        buffer: TINY_JPEG,
      });
      await expect(overview.locator("[data-image-source='host']")).toBeVisible();
      await shotLocator(page, "[data-host-shot='overview']", `host-image-replace-${width}`);
      await overview.getByRole("button", { name: "הסרת תמונה" }).click();
      await expect(overview.locator("[data-image-source='library']")).toHaveAttribute(
        "src",
        /candle-layer-cake-hero\.webp/,
      );
      await expect(overview.locator("[data-image-source='host']")).toHaveCount(0);
    }
  });

  test("an empty host dashboard stays readable", async ({ page }) => {
    for (const width of [390, 1440] as const) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
      await page.goto("/host/example?view=empty");
      await expect(page.getByRole("heading", { name: "אירוע בלי מתנות עדיין" })).toBeVisible();
      await expect(page.getByText("אין מתנות באירוע זה.")).toBeVisible();
      await expect(page.getByText("אין הזמנות עדיין. כשאורחים יבחרו מתנות, ההזמנות יופיעו כאן.")).toBeVisible();
      await expect(page.getByText("אין מוזמנים ברשימה עדיין")).toBeVisible();
      await expect(page.getByText("אין הזמנות ששולמו עדיין")).toBeVisible();
      await shot(page, `host-empty-${width}`);
    }
  });

  test("host screens stay in frame and clear serious axe findings", async ({ page }) => {
    const failures: string[] = [];
    const pages = [
      ["/host", "login"],
      ["/host/example", "dashboard"],
      ["/host/example?view=empty", "empty"],
      ["/beta", "beta"],
    ] as const;
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
      for (const [url, name] of pages) {
        await page.goto(url);
        await expect(page.locator("[data-bold-host]")).toBeVisible();
        const extra = await overflow(page);
        if (extra > 1) {
          failures.push(`${name} ${width} overflow ${extra}`);
        }
        if (width === 390 || width === 1440) {
          const serious = await seriousAxe(page);
          if (serious.length) {
            failures.push(
              `${name} ${width} axe ${serious.map((item) => `${item.id}:${item.nodes.length}`).join(", ")}`,
            );
          }
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("host routes reject a missing or foreign session and hide secrets", async ({ page }) => {
    await page.goto(`/host/events/${EVENT_A}`);
    await expect(page).toHaveURL(/\/host$/);
    await page.goto(`/host/events/${EVENT_B}/vouchers/${GUEST_B}`);
    await expect(page).toHaveURL(/\/host$/);

    await page.context().addCookies([
      {
        name: "lolo_host_session",
        value: "host-a.not-a-real-signature",
        url: "http://127.0.0.1:3000",
      },
    ]);
    await page.goto(`/host/events/${EVENT_B}`);
    await expect(page).toHaveURL(/\/host$/);

    const denied: Array<[string, string]> = [
      ["GET", `/api/host/events/${EVENT_A}/guests`],
      ["POST", `/api/host/events/${EVENT_B}/guests`],
      ["DELETE", `/api/host/events/${EVENT_A}/guests/${GUEST_B}`],
      ["PATCH", `/api/host/events/${EVENT_B}/images`],
      ["POST", `/api/host/events/${EVENT_A}/vouchers`],
    ];
    for (const [method, path] of denied) {
      const response = await page.request.fetch(path, {
        method,
        data: method === "GET" ? undefined : { name: "נועה", phone: "0501234567", imageUrl: "" },
        headers: { cookie: "lolo_host_session=host-a.not-a-real-signature" },
      });
      expect(response.status(), `${method} ${path}`).toBe(401);
    }

    await page.goto("/host/example");
    const html = await page.content();
    expect(html).not.toContain("HOST_SESSION_SECRET");
    expect(html).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(html).not.toContain("accessCode");
    expect(html).not.toContain("service_role");
    expect(html).not.toMatch(/AB12-CD34/);
  });
});
