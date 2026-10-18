import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";

const ARTIFACTS = "/opt/cursor/artifacts/host-experience";
const ACCESS_CODE = "AB12-CD34";

const viewports = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
] as const;

function shot(page: Page, name: string) {
  mkdirSync(ARTIFACTS, { recursive: true });
  return page.screenshot({
    path: `${ARTIFACTS}/${name}.png`,
    fullPage: true,
  });
}

function guestWorkbook() {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["שם", "טלפון"],
    ["דנה כהן", "0501234567"],
  ]);
  XLSX.utils.book_append_sheet(book, sheet, "מוזמנים");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function mockPublish(page: Page) {
  await page.route("**/api/events", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as { title?: string; giftMode?: string };
    expect(body).not.toHaveProperty("videoName");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "11111111-1111-4111-8111-111111111111",
        slug: "event-host-demo",
        accessCode: ACCESS_CODE,
        event: {
          id: "11111111-1111-4111-8111-111111111111",
          slug: "event-host-demo",
          title: body.title || "יום ההולדת של יובל",
          hostName: "נועה",
          eventType: "יום הולדת",
          date: "2026-11-12",
          time: "",
          venueName: "",
          address: "",
          message: "",
          coverImage: "",
          giftMode: body.giftMode || "money",
          moneyAmounts: [150, 250, 350, 500],
          allowCustomAmount: true,
          moneyDisplay: "amounts",
          gifts: [],
          createdAt: "2026-10-18T00:00:00.000Z",
        },
      }),
    });
  });
}

test.describe("host experience", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const viewport of viewports) {
    test(`screenshots ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const pages: Array<[string, string]> = [
        ["/create-event?new=1", `create-step-1-${viewport.name}`],
        ["/create-event/gifts", `create-gifts-${viewport.name}`],
        ["/create-event/gifts/money", `create-gifts-money-${viewport.name}`],
        ["/create-event/gifts/catalog", `create-gifts-catalog-${viewport.name}`],
        ["/create-event/gifts/custom", `create-gifts-custom-${viewport.name}`],
        ["/create-event/gifts/organize", `create-gifts-organize-${viewport.name}`],
        ["/create-event/details", `create-details-${viewport.name}`],
        ["/create-event/guests", `create-guests-${viewport.name}`],
        ["/create-event/preview", `create-preview-${viewport.name}`],
        ["/create-event/success", `create-success-empty-${viewport.name}`],
        ["/host", `host-login-${viewport.name}`],
        ["/host/example", `host-dashboard-${viewport.name}`],
      ];

      for (const [url, name] of pages) {
        await page.goto(url);
        if (url.startsWith("/create-event/success")) {
          await expect(page.getByRole("heading", { name: "עדיין אין אירוע מוכן" })).toBeVisible();
        } else if (url.startsWith("/host/example")) {
          await expect(page.getByText("נתוני דוגמה — לא אירוע אמיתי")).toBeVisible();
        } else if (url === "/host") {
          await expect(page.getByRole("heading", { name: "כניסה לניהול האירוע" })).toBeVisible();
        } else if (url.includes("/preview")) {
          await expect(page.getByText("שלב 5 מתוך 5")).toBeVisible();
        } else if (url.includes("/details")) {
          await expect(page.getByText("שלב 3 מתוך 5")).toBeVisible();
        } else if (url.includes("/guests")) {
          await expect(page.getByText("שלב 4 מתוך 5")).toBeVisible();
        } else if (url.includes("/gifts")) {
          await expect(page.getByText("שלב 2 מתוך 5")).toBeVisible();
        } else {
          await expect(page.getByText("שלב 1 מתוך 5")).toBeVisible();
        }
        await shot(page, name);
      }
    });
  }

  test("publishes a money event without writing the access code to storage", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await mockPublish(page);
    await page.goto("/create-event?new=1");
    await page.getByRole("button", { name: "יום הולדת" }).click();
    await page.getByLabel("שם האירוע").fill("יום ההולדת של יובל");
    await page.getByLabel("מתי חוגגים?").fill("2026-11-12");
    await page.getByLabel("שם בעל/ת האירוע").fill("נועה");
    await page.getByRole("button", { name: "ממשיכים לבחירת המתנות" }).click();
    await expect(page.getByText("שלב 2 מתוך 5")).toBeVisible();
    await page.getByRole("button", { name: /מתנה כספית/ }).click();
    await page.getByRole("button", { name: "ממשיכים" }).click();
    await expect(page).toHaveURL(/\/create-event\/gifts\/money/);
    await page.getByRole("button", { name: "ממשיכים" }).click();
    await expect(page).toHaveURL(/\/create-event\/details/);
    await expect(page.locator('input[accept="video/*"]')).toHaveCount(0);
    await page.getByRole("button", { name: "ממשיכים להזמנת האורחים" }).click();

    await page.getByLabel("שם האורח").fill("ישראל ישראלי");
    await page.getByLabel("מספר טלפון").fill("0521112233");
    await page.getByRole("button", { name: "הוספה לרשימה" }).click();
    await expect(page.getByText("ישראל ישראלי")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: "guests.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: guestWorkbook(),
    });
    await expect(page.getByText("דנה כהן")).toBeVisible();
    await page.getByRole("button", { name: "תצוגה מקדימה של האירוע" }).click();
    await expect(page.getByText("שלב 5 מתוך 5")).toBeVisible();

    await page.getByRole("button", { name: "יצירת האירוע" }).click();
    await expect(page).toHaveURL(/\/create-event\/success\?slug=event-host-demo$/);
    await expect(page.getByText(ACCESS_CODE)).toBeVisible();
    await expect(page.getByText("שמרו את הקוד — בלעדיו אי אפשר לנהל את האירוע")).toBeVisible();
    await page.getByRole("button", { name: "העתקת קוד הניהול" }).click();
    await expect(page.getByText("קוד הניהול הועתק")).toBeVisible();

    const leaked = await page.evaluate((code) => {
      const stored = [...Object.values(localStorage), ...Object.values(sessionStorage)].join("\n");
      return stored.includes(code) || location.href.includes(code);
    }, ACCESS_CODE);
    expect(leaked).toBe(false);

    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("שמרו את הקוד");
      void dialog.dismiss();
    });
    await page.getByRole("link", { name: "פתיחת עמוד האירוע" }).click();
    await expect(page).toHaveURL(/\/create-event\/success/);

    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, "create-success-390");
    await page.setViewportSize({ width: 1440, height: 900 });
    await shot(page, "create-success-1440");
  });

  test("explains image upload failures and hides test stores", async ({ page }) => {
    await page.route("**/api/uploads/images", async (route) => {
      const type = route.request().headers()["content-type"] || "";
      if (type.includes("too-big")) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "התמונה גדולה מדי. נסו תמונה קטנה יותר." }),
        });
        return;
      }
      await route.abort();
    });
    await page.route("**/api/stores", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stores: [
            { id: "books", name: "חנות הספרים" },
            { id: "bike", name: "חנות אופניים - בדיקה" },
            { id: "flagged", name: "חנות הפרחים", test: true },
            { id: "ok", name: "testing bikes" },
          ],
        }),
      });
    });

    await page.goto("/create-event/details");
    await page.locator('input[accept="image/*"]').setInputFiles({
      name: "photo.heic",
      mimeType: "image/heic",
      buffer: Buffer.from("not-an-image"),
    });
    await expect(page.getByRole("alert")).toContainText("HEIC");
    await page.getByRole("button", { name: "הסרת תמונה" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);

    await page.locator('input[accept="image/*"]').setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
    await expect(page.getByRole("alert")).toContainText("לא נתמך");
    await page.getByRole("button", { name: "הסרת תמונה" }).click();

    await page.goto("/create-event/gifts/custom");
    await expect(page.getByRole("option", { name: "חנות הספרים" })).toBeAttached();
    await expect(page.getByRole("option", { name: "testing bikes" })).toBeAttached();
    await expect(page.getByRole("option", { name: "חנות אופניים - בדיקה" })).toHaveCount(0);
    await expect(page.getByRole("option", { name: "חנות הפרחים" })).toHaveCount(0);
  });

  test("host login reports a rejected code and the example dashboard keeps its actions", async ({
    page,
  }) => {
    await page.route("**/api/host/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "קישור האירוע או קוד הניהול שגויים." }),
      });
    });
    await page.goto("/host");
    await page.getByLabel("קישור האירוע או כתובת עמוד האורחים").fill("event-host-demo");
    await page.getByLabel("קוד ניהול פרטי").fill("ZZZZ-ZZZZ");
    await page.getByRole("button", { name: "כניסה" }).click();
    await expect(page.getByText("קישור האירוע או קוד הניהול שגויים.")).toBeVisible();

    await page.goto("/host/example");
    await expect(page.getByText("נתוני דוגמה — לא אירוע אמיתי")).toBeVisible();
    await page.getByRole("button", { name: "הנפקת שובר" }).click();
    await expect(page.getByRole("option", { name: "חנות הספרים" })).toBeAttached();
    await expect(page.getByRole("option", { name: "חנות אופניים - בדיקה" })).toHaveCount(0);

    await page.route("**/api/host/events/**/guests", async (route) => {
      expect(route.request().method()).toBe("POST");
      const body = route.request().postDataJSON() as { name?: string; phone?: string };
      expect(body.name).toBe("מיכל");
      expect(body.phone).toBe("0540001122");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.getByLabel("שם האורח").fill("מיכל");
    await page.getByLabel("מספר טלפון").fill("0540001122");
    await page.getByRole("button", { name: "הוספת אורח" }).click();

    await page.unroute("**/api/host/events/**/guests");
    await page.route("**/api/host/events/**/guests/**", async (route) => {
      expect(route.request().method()).toBe("DELETE");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.getByRole("button", { name: "הסרה" }).click();
  });
});
