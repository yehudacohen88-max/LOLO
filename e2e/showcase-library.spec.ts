import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const artifactDir = process.env.FLAGSHIP_ARTIFACT_DIR || "/opt/cursor/artifacts";
const portraitPath = path.join(__dirname, "fixtures/flagship/portrait.jpg");
const giftPath = path.join(__dirname, "fixtures/flagship/gift.png");
const widths = [320, 360, 390, 768, 1024, 1440] as const;

function hostPayload() {
  return {
    event: {
      id: "host-image-id",
      slug: "host-image-event",
      title: "יום הולדת 30 למיכל",
      hostName: "יעל אברהם",
      eventType: "יום הולדת",
      date: "2026-12-04",
      time: "20:00",
      venueName: "הבית של יעל",
      address: "ירמיהו 18, תל אביב",
      message: "מיכל ביקשה השנה מתנה אחת גדולה, מכולנו יחד.",
      coverImage: "/__flagship_fixture/portrait.jpg",
      giftMode: "catalog",
      moneyAmounts: [150, 250, 350, 500],
      allowCustomAmount: true,
      moneyDisplay: "amounts",
      gifts: [
        {
          id: "gift-host-coffee",
          eventId: "host-image-id",
          title: "מכונת קפה",
          description: "התמונה של המארח.",
          targetAmount: 1800,
          icon: "",
          imageUrl: "/__flagship_fixture/gift.png",
          source: "custom",
          priority: 0,
          active: true,
          storeId: null,
          storeName: "",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function defaultsPayload() {
  return {
    event: {
      id: "defaults-id",
      slug: "defaults-event",
      title: "יום הולדת בלי תמונות",
      hostName: "נועה לוי",
      eventType: "יום הולדת",
      date: "2026-11-20",
      time: "18:00",
      venueName: "",
      address: "",
      message: "אין תמונות שהועלו.",
      coverImage: "",
      giftMode: "catalog",
      moneyAmounts: [150, 250, 350, 500],
      allowCustomAmount: true,
      moneyDisplay: "amounts",
      gifts: [
        {
          id: "gift-console",
          eventId: "defaults-id",
          title: "קונסולת משחקים",
          description: "",
          targetAmount: 2000,
          icon: "",
          imageUrl: "",
          source: "custom",
          priority: 0,
          active: true,
          storeId: null,
          storeName: "",
        },
        {
          id: "gift-coffee",
          eventId: "defaults-id",
          title: "מכונת אספרסו",
          description: "",
          targetAmount: 2500,
          icon: "",
          imageUrl: "",
          source: "custom",
          priority: 1,
          active: true,
          storeId: null,
          storeName: "",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

async function mockEvent(page: Page, slug: string, body: unknown) {
  await page.route(`**/api/events/${slug}/funding`, async (route) => {
    await route.fulfill({ json: { gifts: [] } });
  });
  await page.route(`**/api/events/${slug}`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.abort();
      return;
    }
    await route.fulfill({ json: body });
  });
  await page.route("**/__flagship_fixture/portrait.jpg", async (route) => {
    await route.fulfill({ path: portraitPath, contentType: "image/jpeg" });
  });
  await page.route("**/__flagship_fixture/gift.png", async (route) => {
    await route.fulfill({ path: giftPath, contentType: "image/png" });
  });
}

function trackWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      writes.push(`${request.method()} ${request.url()}`);
    }
  });
  return writes;
}

async function layoutReport(page: Page) {
  return page.evaluate(() => {
    function channel(value: number) {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }
    function luminance(color: string) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return null;
      const [, r, g, b] = match;
      return 0.2126 * channel(Number(r)) + 0.7152 * channel(Number(g)) + 0.0722 * channel(Number(b));
    }
    function contrast(a: number, b: number) {
      const [hi, lo] = a > b ? [a, b] : [b, a];
      return (hi + 0.05) / (lo + 0.05);
    }
    const root = document.querySelector(".guest-shell") || document.querySelector("[data-celebration]");
    if (!root) return { overflow: 999, small: ["missing celebration"], weak: ["missing celebration"] };
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const small: string[] = [];
    for (const node of root.querySelectorAll("a, button, input, textarea")) {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.width < 44 || rect.height < 44) {
        small.push(`${node.tagName} ${(node.textContent || "").trim().slice(0, 24)} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }
    const weak: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let text = walker.nextNode();
    while (text) {
      const value = text.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const parent = text.parentElement;
      if (value && parent) {
        const style = getComputedStyle(parent);
        if (style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0) {
          const rect = parent.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            let bgNode: HTMLElement | null = parent;
            let bgColor = "rgba(0, 0, 0, 0)";
            while (bgNode) {
              const painted = getComputedStyle(bgNode).backgroundColor;
              if (painted !== "rgba(0, 0, 0, 0)" && !painted.endsWith(", 0)")) {
                bgColor = painted;
                break;
              }
              bgNode = bgNode.parentElement;
            }
            const fg = luminance(style.color);
            const bg = luminance(bgColor);
            const size = Number.parseFloat(style.fontSize);
            const bold = Number(style.fontWeight) >= 700;
            const large = size >= 24 || (bold && size >= 18.66);
            const needed = large ? 3 : 4.5;
            if (fg != null && bg != null && contrast(fg, bg) < needed) {
              weak.push(`${value.slice(0, 28)} ${contrast(fg, bg).toFixed(2)}:1 on ${bgColor}`);
            }
          }
        }
      }
      text = walker.nextNode();
    }
    return { overflow, small, weak: [...new Set(weak)].slice(0, 8) };
  });
}

test("a host upload wins over the library and is not labeled illustrative", async ({ page }) => {
  await mockEvent(page, "host-image-event", hostPayload());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/e/host-image-event");
  await expect(page.getByRole("heading", { name: /יום הולדת 30 למיכל/ })).toBeVisible();
  await expect(page.locator("[data-portrait]")).toHaveAttribute("src", "/__flagship_fixture/portrait.jpg");
  await expect(page.locator("[data-portrait]")).toHaveAttribute("data-image-source", "host");
  await expect(page.locator("[data-gift-photo]")).toHaveAttribute("src", "/__flagship_fixture/gift.png");
  await expect(page.locator("[data-gift-photo]")).toHaveAttribute("data-image-source", "host");
  await expect(page.locator("[data-illustrative-label]")).toHaveCount(0);
  await page.waitForTimeout(1600);
  const srcs = await page.locator("img").evaluateAll((images) =>
    images.map((image) => image.getAttribute("src") || ""),
  );
  expect(srcs.join(" ")).not.toContain("/images/library/");
  await page.screenshot({
    path: path.join(artifactDir, "pr-a-host-cover-1440.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(artifactDir, "pr-a-host-cover-390.png"),
    fullPage: true,
  });
});

test("an event with no uploads uses library defaults and does not send a console to travel", async ({ page }) => {
  await mockEvent(page, "defaults-event", defaultsPayload());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/e/defaults-event");
  await expect(page.locator("[data-portrait]")).toHaveAttribute("src", /\/images\/library\/birthday\//);
  await expect(page.locator("[data-portrait]")).toHaveAttribute("data-image-source", "library");
  const giftSources = await page.locator("[data-gift-photo]").evaluateAll((images) =>
    images.map((image) => image.getAttribute("src") || ""),
  );
  expect(giftSources.some((src) => src.includes("/images/library/gifts/"))).toBe(true);
  expect(giftSources.some((src) => src.includes("/images/library/coffee/"))).toBe(true);
  expect(giftSources.join(" ")).not.toContain("/travel/");
  await expect(page.locator("[data-illustrative-label]").first()).toHaveText("תמונה להמחשה");
  const loaded = await page.locator("[data-celebration] img").evaluateAll((images) =>
    images.map((image) => ({
      src: image.getAttribute("src") || "",
      width: (image as HTMLImageElement).naturalWidth,
    })),
  );
  expect(loaded.length).toBeGreaterThan(0);
  for (const image of loaded) {
    expect(image.width, image.src).toBeGreaterThan(10);
  }
  await page.waitForTimeout(1600);
  await page.screenshot({
    path: path.join(artifactDir, "pr-a-defaults-1440.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(artifactDir, "pr-a-defaults-390.png"),
    fullPage: true,
  });
});

test("demo event keeps its own photos, shrinks the badge, and shows the espresso cutout", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/e/demo-event");
  await expect(page.locator("[data-portrait]")).toHaveAttribute("src", "/demo/celebrant.jpg");
  await expect(page.locator("[data-gift-photo]")).toHaveAttribute("src", "/demo/espresso.png");
  await expect(page.locator("[data-cele='scene']")).toHaveAttribute("data-fit", "contain");
  const fit = await page.locator("[data-gift-photo]").evaluate((element) => getComputedStyle(element).objectFit);
  expect(fit).toBe("contain");
  await expect(page.locator("[data-cele='sub']")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "חוגגים 40 לדנה — מתנה מכל החברים" })).toBeVisible();
  const badge = await page.locator("[data-cele='demo-badge']").boundingBox();
  expect(badge).not.toBeNull();
  expect(badge!.width).toBeLessThan(720);
  expect(badge!.width).toBeGreaterThan(120);
});

test("showcase renders real event scenes without API writes", async ({ page }) => {
  test.setTimeout(120_000);
  const writes = trackWrites(page);
  const failures: string[] = [];

  for (const scene of ["birthday", "plain"] as const) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
      const apiCalls: string[] = [];
      const onRequest = (request: { url: () => string }) => {
        if (request.url().includes("/api/")) apiCalls.push(request.url());
      };
      page.on("request", onRequest);
      await page.goto(`/showcase?scene=${scene}`);
      await expect(page.getByText("הדגמה — נתונים לדוגמה בלבד")).toBeVisible();
      await expect(page.locator("[data-celebration] img").first()).toBeVisible();
      await page.waitForFunction(() =>
        [...document.querySelectorAll("[data-celebration] img")].every(
          (image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
        ),
      );
      page.off("request", onRequest);
      if (apiCalls.length) failures.push(`${scene} ${width} api ${apiCalls.join(" ")}`);

      const report = await layoutReport(page);
      if (report.overflow > 1) failures.push(`${scene} ${width} overflow ${report.overflow}`);
      if (report.small.length) failures.push(`${scene} ${width} targets ${report.small.join("; ")}`);
      if (report.weak.length) failures.push(`${scene} ${width} contrast ${report.weak.join("; ")}`);

        if (width === 390 || width === 1440) {
          await page.waitForTimeout(1600);
        const axe = await new AxeBuilder({ page }).include(".guest-shell").analyze();
        const serious = axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
        if (serious.length) {
          failures.push(`${scene} ${width} axe ${serious.map((item) => item.id).join(", ")}`);
        }
        await page.screenshot({
          path: path.join(artifactDir, `pr-a-showcase-${scene}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/showcase?scene=birthday");
  await page.getByRole("button", { name: "מצטרפים למתנה" }).click();
  await expect(page.locator("#join-amount-hint")).toHaveText("בחרו סכום כדי להצטרף");
  await expect(page).toHaveURL(/\/showcase\?scene=birthday/);
  await page.getByRole("button", { name: /150/ }).first().click();
  await page.getByRole("button", { name: "מצטרפים למתנה" }).click();
  await expect(page.locator("[data-showcase-demo-state]")).toHaveText(
    "מצב הדגמה: לא נוצרה הזמנה ולא נשמר תשלום.",
  );
  await expect(page).toHaveURL(/\/showcase/);

  await page.getByRole("button", { name: "חתונה" }).click();
  await expect(page.getByRole("heading", { name: /החתונה של דנה ואורי/ })).toBeVisible();
  await expect(page.locator("[data-portrait]")).toHaveAttribute("src", /\/images\/library\/wedding\//);
  await expect(page.locator("[data-illustrative-label]").first()).toBeVisible();

  expect(writes, writes.join("\n")).toEqual([]);
  expect(failures, failures.join("\n")).toEqual([]);
});
