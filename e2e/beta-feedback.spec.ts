import { expect, test, type Page } from "@playwright/test";
import { EVENT_FIELD_ERRORS, EVENT_FIELD_LIMITS } from "@/lib/events/text-limits";

const ADDRESS = "רחוב הזית 12, תל אביב";

function guestEvent(address: string, eventType = "ברית / בריתה") {
  return {
    event: {
      id: "venue-fixture-id",
      slug: "venue-fixture",
      title: "הברית של יונתן",
      hostName: "נועה",
      eventType,
      date: "2026-11-12",
      time: "11:00",
      venueName: "אולם הדר",
      address,
      message: "",
      coverImage: "",
      giftMode: "money",
      moneyAmounts: [150],
      allowCustomAmount: true,
      moneyDisplay: "amounts",
      gifts: [],
      createdAt: "2026-10-01T00:00:00.000Z",
    },
  };
}

async function installGuest(page: Page, address: string) {
  await page.route("**/api/events/venue-fixture**", async (route) => {
    const url = route.request().url();
    if (url.includes("/funding")) {
      await route.fulfill({ json: { gifts: [] } });
      return;
    }
    await route.fulfill({ json: guestEvent(address) });
  });
}

test("create event offers separate brit options and keeps a legacy draft", async ({ page }) => {
  await page.goto("/create-event?new=1");
  await expect(page.getByRole("button", { name: "ברית מילה", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "בריתה", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ברית / בריתה", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "ברית מילה", exact: true }).click();
  await expect(page.getByRole("button", { name: "ברית מילה", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "lolo-event-draft",
      JSON.stringify({ eventType: "ברית / בריתה" }),
    );
  });
  await page.goto("/create-event");
  const legacy = page.getByRole("button", { name: "ברית / בריתה", exact: true });
  await expect(legacy).toBeVisible();
  await expect(legacy).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "ברית מילה", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "בריתה", exact: true })).toBeVisible();
});

test("guest venue block links to Waze and Google Maps only when there is an address", async ({
  page,
}) => {
  await installGuest(page, ADDRESS);
  await page.goto("/e/venue-fixture");
  await expect(page.getByText("ברית / בריתה", { exact: true })).toBeVisible();
  const venue = page.locator("[data-venue]");
  await expect(venue.getByText("אולם הדר")).toBeVisible();
  await expect(venue.getByText(ADDRESS)).toBeVisible();

  const encoded = encodeURIComponent(ADDRESS);
  const waze = venue.getByRole("link", { name: "Waze", exact: true });
  const maps = venue.getByRole("link", { name: "Google Maps", exact: true });
  await expect(waze).toHaveAttribute("href", `https://waze.com/ul?q=${encoded}&navigate=yes`);
  await expect(waze).toHaveAttribute("target", "_blank");
  await expect(waze).toHaveAttribute("rel", "noopener noreferrer");
  await expect(maps).toHaveAttribute(
    "href",
    `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  );
  await expect(maps).toHaveAttribute("target", "_blank");
  await expect(maps).toHaveAttribute("rel", "noopener noreferrer");

  await installGuest(page, "");
  await page.goto("/e/venue-fixture");
  await expect(page.locator("[data-venue]").getByText("אולם הדר")).toBeVisible();
  await expect(page.getByRole("link", { name: "Waze", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Google Maps", exact: true })).toHaveCount(0);
});

test("event text fields keep the published caps and explain them in Hebrew", async ({ page }) => {
  await page.goto("/create-event?new=1");
  await expect(page.getByLabel("שם האירוע")).toHaveAttribute(
    "maxlength",
    String(EVENT_FIELD_LIMITS.title),
  );

  await page.goto("/create-event/details");
  await expect(page.getByLabel("כמה מילים לאורחים")).toHaveAttribute(
    "maxlength",
    String(EVENT_FIELD_LIMITS.message),
  );
  await expect(page.getByLabel("שם המקום / האולם")).toHaveAttribute(
    "maxlength",
    String(EVENT_FIELD_LIMITS.venueName),
  );
  await expect(page.getByLabel("כתובת")).toHaveAttribute(
    "maxlength",
    String(EVENT_FIELD_LIMITS.address),
  );

  await page.addInitScript((limits) => {
    window.localStorage.setItem(
      "lolo-event-draft",
      JSON.stringify({
        eventType: "יום הולדת",
        eventName: "א".repeat(limits.title + 1),
        eventDate: "2026-11-12",
        hostName: "נועה",
        message: "ב".repeat(limits.message + 1),
        venueName: "ג".repeat(limits.venueName + 1),
        address: "ד".repeat(limits.address + 1),
      }),
    );
  }, EVENT_FIELD_LIMITS);
  await page.goto("/create-event");
  await expect(
    page.getByRole("alert").filter({ hasText: EVENT_FIELD_ERRORS.title }),
  ).toHaveText(EVENT_FIELD_ERRORS.title);
  await page.getByRole("button", { name: "ממשיכים לבחירת המתנות" }).click();
  await expect(page).toHaveURL(/\/create-event$/);

  await page.goto("/create-event/details");
  await expect(page.getByText(EVENT_FIELD_ERRORS.message)).toBeVisible();
  await expect(page.getByText(EVENT_FIELD_ERRORS.venueName)).toBeVisible();
  await expect(page.getByText(EVENT_FIELD_ERRORS.address)).toBeVisible();
  await page.getByRole("button", { name: "ממשיכים להזמנת האורחים" }).click();
  await expect(page).toHaveURL(/\/create-event\/details$/);
});

test("guest pages stay out of the index", async ({ page }) => {
  const robots = await page.request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toMatch(/Disallow:\s*\//);

  await page.goto("/e/demo-event");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /nofollow/,
  );

  await page.goto("/e/demo-event/payment");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});
