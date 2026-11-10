import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const artifactDir = process.env.FLAGSHIP_ARTIFACT_DIR || "/opt/cursor/artifacts";
const baseURL = process.env.CAPTURE_BASE_URL || "http://127.0.0.1:3000";
const fixtureDir = path.join(process.cwd(), "e2e/fixtures/celebration");

function eventPayload(withImages) {
  const slug = withImages ? "celebration-with-images" : "celebration-no-images";
  return {
    event: {
      id: withImages ? "celebration-with-id" : "celebration-none-id",
      slug,
      title: withImages ? "יום הולדת 30 למיכל" : "החתונה של דנה ואורי",
      hostName: withImages ? "יעל אברהם" : "משפחת לוי",
      eventType: withImages ? "יום הולדת" : "חתונה",
      date: withImages ? "2026-12-04" : "2026-06-18",
      time: withImages ? "20:00" : "18:30",
      venueName: withImages ? "הבית של יעל" : "גן אירועים השקד",
      address: withImages ? "ירמיהו 18, תל אביב" : "הכרמל 12, זכרון יעקב",
      message: withImages
        ? "מיכל ביקשה השנה מתנה אחת גדולה, מכולנו יחד."
        : "במקום עוד מעטפה, בא לכם להגשים להם מתנה שהם באמת רוצים.",
      coverImage: withImages ? "/__celebration/cover.jpg" : "",
      giftMode: "catalog",
      moneyAmounts: [150, 250, 350, 500],
      allowCustomAmount: true,
      moneyDisplay: "amounts",
      gifts: [
        {
          id: "gift-trip",
          eventId: withImages ? "celebration-with-id" : "celebration-none-id",
          title: "חופשה זוגית",
          description: withImages ? "סוף שבוע לשניים." : "סוף שבוע לשניים, אחרי החתונה.",
          targetAmount: withImages ? 3200 : 1500,
          icon: "",
          imageUrl: withImages ? "/__celebration/vacation.jpg" : "",
          source: "custom",
          priority: 0,
          active: true,
          storeId: null,
          storeName: "",
        },
        {
          id: "gift-coffee",
          eventId: withImages ? "celebration-with-id" : "celebration-none-id",
          title: "מכונת קפה",
          description: "לבית החדש.",
          targetAmount: withImages ? 1800 : 2500,
          icon: "",
          imageUrl: withImages ? "/__celebration/coffee.jpg" : "",
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

function fundingPayload(withImages) {
  if (withImages) {
    return {
      gifts: [
        { giftId: "gift-trip", raisedAmount: 2100, contributorCount: 16, percentOfTarget: 65.6 },
        { giftId: "gift-coffee", raisedAmount: 720, contributorCount: 6, percentOfTarget: 40 },
      ],
    };
  }
  return {
    gifts: [
      { giftId: "gift-trip", raisedAmount: 980, contributorCount: 11, percentOfTarget: 65.3 },
      { giftId: "gift-coffee", raisedAmount: 600, contributorCount: 4, percentOfTarget: 24 },
    ],
  };
}

async function installRoutes(page, withImages) {
  const slug = withImages ? "celebration-with-images" : "celebration-no-images";
  await page.route(`**/api/events/${slug}/funding`, async (route) => {
    await route.fulfill({ json: fundingPayload(withImages) });
  });
  await page.route(`**/api/events/${slug}`, async (route) => {
    await route.fulfill({ json: eventPayload(withImages) });
  });
  await page.route("**/api/invite/identity**", async (route) => {
    await route.fulfill({ status: 404, json: {} });
  });
  await page.route("**/__celebration/cover.jpg", async (route) => {
    await route.fulfill({
      path: path.join(fixtureDir, "cover.jpg"),
      contentType: "image/jpeg",
    });
  });
  await page.route("**/__celebration/vacation.jpg", async (route) => {
    await route.fulfill({
      path: path.join(fixtureDir, "vacation.jpg"),
      contentType: "image/jpeg",
    });
  });
  await page.route("**/__celebration/coffee.jpg", async (route) => {
    await route.fulfill({
      path: path.join(fixtureDir, "coffee.jpg"),
      contentType: "image/jpeg",
    });
  });
}

const shots = [
  ["A-bold", "bold", true, 390],
  ["A-bold", "bold", true, 1440],
  ["A-bold", "bold", false, 390],
  ["A-bold", "bold", false, 1440],
  ["B-elegant", "elegant", true, 390],
  ["B-elegant", "elegant", true, 1440],
  ["B-elegant", "elegant", false, 390],
  ["B-elegant", "elegant", false, 1440],
];

const browser = await chromium.launch();
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();

const onlyLook = process.env.CAPTURE_LOOK;
for (const [prefix, look, withImages, width] of shots) {
  if (onlyLook && look !== onlyLook) {
    continue;
  }
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await installRoutes(page, withImages);
  const slug = withImages ? "celebration-with-images" : "celebration-no-images";
  await page.goto(`${baseURL}/e/${slug}?look=${look}`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.getByRole("button", { name: "מצטרפים למתנה" }).waitFor();
  const metrics = await page.evaluate(() => {
    const fill = document.querySelector("[data-cele='fill']");
    const track = document.querySelector("[data-cele='track']");
    const fillBox = fill?.getBoundingClientRect();
    const trackBox = track?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      raised: document.querySelector("[data-cele='raised']")?.textContent || "",
      fill: fillBox ? { x: Math.round(fillBox.x), w: Math.round(fillBox.width) } : null,
      track: trackBox ? { x: Math.round(trackBox.x), w: Math.round(trackBox.width) } : null,
    };
  });
  console.log(prefix, withImages, width, JSON.stringify(metrics));
  const name = `${prefix}_${withImages ? "with-images" : "no-images"}_${width}.png`;
  await page.screenshot({
    path: path.join(artifactDir, name),
    fullPage: true,
  });
  console.log(name);
  await page.unroute("**/*");
}

await browser.close();
console.log("capture-dir", pathToFileURL(artifactDir).href);
