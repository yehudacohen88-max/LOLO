import { expect, test } from "@playwright/test";

test("landing explains LOLO and links to create an event", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "המתנה שבאמת רצית" })).toBeVisible();
  await expect(page.getByText("היעד של המתנה הוא יעד, לא תקרה")).toBeVisible();
  await expect(page.getByRole("link", { name: "יצירת אירוע" })).toBeVisible();
  await page.getByRole("link", { name: "יצירת אירוע" }).click();
  await expect(page).toHaveURL(/\/create-event/);
  await expect(page.getByRole("heading", { name: "בואו ניצור את האירוע שלכם" })).toBeVisible();
});

test("host and store sign-in render without a database", async ({ page }) => {
  await page.goto("/host");
  await expect(page.getByRole("heading", { name: "כניסה לניהול האירוע" })).toBeVisible();
  await expect(page.getByText("קישור האירוע או כתובת עמוד האורחים")).toBeVisible();

  await page.goto("/store");
  await expect(page.getByRole("heading", { name: "כניסה למימוש שוברים" })).toBeVisible();
  await expect(page.getByText("שם הכניסה של החנות", { exact: true })).toBeVisible();
});

test("admin sign-in degrades when management is not configured", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "כניסה לניהול LOLO" })).toBeVisible();
  await expect(page.getByText("הכניסה לניהול עדיין לא הופעלה.")).toBeVisible();
});

test("a missing event and an unknown page stay friendly", async ({ page }) => {
  await page.goto("/e/missing-demo-event");
  await expect(page.getByRole("heading", { name: "האירוע לא נמצא" })).toBeVisible();
  await expect(page.getByRole("link", { name: "לדף הבית" })).toBeVisible();

  const response = await page.goto("/no-such-lolo-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "העמוד לא נמצא" })).toBeVisible();
  await expect(page.getByText("Supabase")).toHaveCount(0);
});

test("a bad store address does not become a server error", async ({ page }) => {
  const response = await page.goto("/admin/stores/not-a-uuid");
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByText("טעינת בית העסק נכשלה")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /כניסה לניהול LOLO|העמוד לא נמצא/ })).toBeVisible();
});

test("the bundled sample event renders without a database", async ({ page }) => {
  await page.goto("/e/demo-event");
  await expect(page.getByRole("heading", { name: "מכונת אספרסו פרימיום" })).toBeVisible();
  await expect(page.getByText("אירוע הדגמה — נתונים לדוגמה").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "מצטרפים למתנה" })).toBeVisible();
  await expect(page.getByText("תשלום הדגמה — לא מתבצע חיוב אמיתי")).toBeVisible();
});

test("an unknown invite does not leak a stack trace", async ({ request }) => {
  const response = await request.get("/i/not-a-real-invite");
  expect([404, 503]).toContain(response.status());
  const body = await response.text();
  expect(body).toContain("LOLO");
  expect(body).not.toContain("Supabase");
  expect(body).not.toContain("stack");
});

test("beta sign-in uses the LOLO flagship design", async ({ page }) => {
  await page.goto("/beta?notice=invalid");
  await expect(page.getByRole("heading", { name: "כניסה לבטא" })).toBeVisible();
  await expect(page.getByRole("link", { name: "lolo" })).toBeVisible();
  await expect(page.getByText("הסיסמה שגויה.")).toBeVisible();
  const button = page.getByRole("button", { name: "כניסה" });
  await expect(button).toHaveCSS("background-color", "rgb(184, 50, 28)");
});
