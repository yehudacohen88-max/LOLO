import { expect, test } from "@playwright/test";

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABLAAEBAAAAAAAAAAAAAAAAAAAABgEBAAAAAAAAAAAAAAAAAAAABhABAAAAAAAAAAAAAAAAAAAAABEBAAAAAAAAAAAAAAAAAAAAAP/AABEIAAgACAMBIgACEQADEQD/2gAMAwEAAhEDEQA/ALcApHn/2Q==",
  "base64",
);

const COVER_URL = "http://127.0.0.1:3000/__photo__/cover.jpg";
const REPLACED_URL = "http://127.0.0.1:3000/__photo__/replaced.jpg";

test("an empty details step can continue", async ({ page }) => {
  await page.goto("/create-event/details");
  await page.getByRole("button", { name: "ממשיכים להזמנת האורחים" }).click();
  await expect(page).toHaveURL(/\/create-event\/guests/);
  await expect(page.getByText("שלב 4 מתוך 4")).toBeVisible();
});

test("a failed cover upload explains the problem and does not trap the step", async ({ page }) => {
  await page.goto("/create-event/details");
  await page.locator('input[accept="image/*"]').setInputFiles({
    name: "phone.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
  await expect(page.getByRole("alert").filter({ hasText: "העלאת התמונה נכשלה" })).toBeVisible();
  await expect(page.getByRole("button", { name: "הסרת תמונה" })).toHaveCount(0);
  await page.getByRole("button", { name: "ממשיכים להזמנת האורחים" }).click();
  await expect(page).toHaveURL(/\/create-event\/guests/);
});

test("a chosen cover can be replaced or removed without clearing the other fields", async ({
  page,
}) => {
  let uploads = 0;
  await page.route("**/api/uploads/images", async (route) => {
    uploads += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: uploads === 1 ? COVER_URL : REPLACED_URL }),
    });
  });
  await page.route("**/__photo__/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      body: TINY_JPEG,
    });
  });

  await page.goto("/create-event/details");
  await page.getByLabel("שם המקום / האולם").fill("בית שלנו");
  await page.getByLabel("כתובת").fill("הזית 73");
  await page.getByLabel("שעת האירוע").fill("21:30");
  await page.getByLabel("כמה מילים לאורחים").fill("נשמח לראות אתכם");

  await page.locator('input[accept="image/*"]').setInputFiles({
    name: "large-phone.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
  await expect(page.getByRole("img", { name: "תצוגה מקדימה של תמונת האירוע" })).toBeVisible();
  await expect(page.getByRole("button", { name: "החלפת תמונה" })).toBeVisible();
  await expect(page.getByRole("button", { name: "הסרת תמונה" })).toBeVisible();

  await page.locator('input[accept="image/*"]').setInputFiles({
    name: "other-phone.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
  await expect(page.getByRole("img", { name: "תצוגה מקדימה של תמונת האירוע" })).toHaveAttribute(
    "src",
    REPLACED_URL,
  );
  await expect(page.getByLabel("שם המקום / האולם")).toHaveValue("בית שלנו");

  await page.locator('input[accept="video/*"]').setInputFiles({
    name: "greeting.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("not-a-real-video"),
  });
  await expect(page.getByRole("button", { name: "החלפת סרטון" })).toBeVisible();
  await expect(page.getByRole("button", { name: "הסרת סרטון" })).toBeVisible();
  await page.getByRole("button", { name: "הסרת סרטון" }).click();
  await expect(page.getByText("greeting.mp4")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "בחירת סרטון" })).toBeVisible();

  await page.getByRole("button", { name: "הסרת תמונה" }).click();
  await expect(page.getByText("עדיין לא נבחרה תמונה")).toBeVisible();
  await expect(page.getByLabel("שם המקום / האולם")).toHaveValue("בית שלנו");
  await expect(page.getByLabel("כתובת")).toHaveValue("הזית 73");
  await expect(page.getByLabel("שעת האירוע")).toHaveValue("21:30");
  await expect(page.getByLabel("כמה מילים לאורחים")).toHaveValue("נשמח לראות אתכם");

  const draft = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("lolo-event-draft") || "{}"),
  );
  expect(draft.imageDataUrl).toBe("");
  expect(draft.videoName).toBe("");
  expect(draft.venueName).toBe("בית שלנו");
  expect(draft.address).toBe("הזית 73");
  expect(draft.message).toBe("נשמח לראות אתכם");

  await page.getByRole("button", { name: "ממשיכים להזמנת האורחים" }).click();
  await expect(page).toHaveURL(/\/create-event\/guests/);
  await expect(page.getByText("שלב 4 מתוך 4")).toBeVisible();
});

test("a cover that cannot be stored blocks continue, scrolls, and explains in Hebrew", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "lolo-event-draft",
      JSON.stringify({
        venueName: "בית שלנו",
        address: "הזית 73",
        eventTime: "21:30",
        message: "נשמח לראות אתכם",
        imageDataUrl: "data:image/jpeg;base64,AAAA",
        videoName: "",
      }),
    );
  });

  await page.goto("/create-event/details");
  const alert = page.getByRole("alert").filter({ hasText: "לא הצלחנו לשמור את התמונה" });
  await expect(alert).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole("button", { name: "ממשיכים להזמנת האורחים" }).click();
  await expect(page).toHaveURL(/\/create-event\/details/);
  await expect(page.getByRole("button", { name: "החלפת תמונה" })).toBeFocused();
  await expect(page.getByRole("button", { name: "החלפת תמונה" })).toBeInViewport();
  await expect(page.getByLabel("שם המקום / האולם")).toHaveValue("בית שלנו");

  await page.getByRole("button", { name: "הסרת תמונה" }).click();
  await expect(alert).toHaveCount(0);
  await expect(page.getByLabel("כתובת")).toHaveValue("הזית 73");
  await page.getByRole("button", { name: "ממשיכים להזמנת האורחים" }).click();
  await expect(page).toHaveURL(/\/create-event\/guests/);
});

test("a custom gift image can be removed without clearing the name or target", async ({
  page,
}) => {
  await page.route("**/api/uploads/images", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: COVER_URL }),
    });
  });
  await page.route("**/__photo__/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      body: TINY_JPEG,
    });
  });

  await page.goto("/create-event/gifts/custom");
  await page.getByRole("button", { name: "שמירת המתנה" }).click();
  await expect(page.getByText("נא למלא שם למתנה.")).toBeVisible();
  await expect(page.getByLabel("שם המתנה")).toBeFocused();

  await page.getByLabel("שם המתנה").fill("אופניים");
  await page.getByRole("button", { name: "שמירת המתנה" }).click();
  await expect(page.getByText("נא להזין יעד גדול מ־0.")).toBeVisible();
  await expect(page.getByLabel("יעד בשקלים")).toBeFocused();

  await page.getByLabel("יעד בשקלים").fill("2500");
  await page.locator('input[accept="image/*"]').setInputFiles({
    name: "gift.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
  await expect(page.getByRole("button", { name: "החלפת תמונה" })).toBeVisible();
  await expect(page.getByRole("button", { name: "הסרת תמונה" })).toBeVisible();
  await page.getByRole("button", { name: "הסרת תמונה" }).click();
  await expect(page.getByRole("button", { name: "בחירת תמונה" })).toBeVisible();
  await expect(page.getByLabel("שם המתנה")).toHaveValue("אופניים");
  await expect(page.getByLabel("יעד בשקלים")).toHaveValue("2500");
});
