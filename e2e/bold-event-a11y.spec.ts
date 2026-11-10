import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const portraitPath = path.join(__dirname, "fixtures/flagship/portrait.jpg");
const giftPath = path.join(__dirname, "fixtures/flagship/gift.png");

const widths = [320, 360, 390, 768, 1024, 1440] as const;

function eventPayload(withImages: boolean) {
  return {
    event: {
      id: "bold-a11y-id",
      slug: "bold-a11y",
      title: withImages ? "יום הולדת 30 למיכל" : "החתונה של דנה ואורי",
      hostName: withImages ? "יעל אברהם" : "משפחת לוי",
      eventType: withImages ? "יום הולדת" : "חתונה",
      date: "2026-12-04",
      time: "20:00",
      venueName: "הבית של יעל",
      address: "ירמיהו 18, תל אביב",
      message: "מיכל ביקשה השנה מתנה אחת גדולה, מכולנו יחד.",
      coverImage: withImages ? "/__flagship_fixture/portrait.jpg" : "",
      giftMode: "catalog",
      moneyAmounts: [150, 250, 350, 500],
      allowCustomAmount: true,
      moneyDisplay: "amounts",
      gifts: [
        {
          id: "gift-trip",
          eventId: "bold-a11y-id",
          title: "חופשה זוגית",
          description: "סוף שבוע לשניים.",
          targetAmount: 1500,
          icon: "",
          imageUrl: withImages ? "/__flagship_fixture/portrait.jpg" : "",
          source: "custom",
          priority: 0,
          active: true,
          storeId: null,
          storeName: "",
        },
        {
          id: "gift-coffee",
          eventId: "bold-a11y-id",
          title: "מכונת קפה",
          description: "לבית החדש.",
          targetAmount: 2500,
          icon: "",
          imageUrl: withImages ? "/__flagship_fixture/gift.png" : "",
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

async function install(page: Page, withImages: boolean) {
  await page.route("**/api/events/bold-a11y/funding", async (route) => {
    await route.fulfill({
      json: {
        gifts: [
          { giftId: "gift-trip", raisedAmount: 980, contributorCount: 11, percentOfTarget: 65.3 },
          { giftId: "gift-coffee", raisedAmount: 600, contributorCount: 4, percentOfTarget: 24 },
        ],
      },
    });
  });
  await page.route("**/api/events/bold-a11y", async (route) => {
    await route.fulfill({ json: eventPayload(withImages) });
  });
  await page.route("**/api/invite/identity**", async (route) => {
    await route.fulfill({ status: 404, json: {} });
  });
  await page.route("**/__flagship_fixture/portrait.jpg", async (route) => {
    await route.fulfill({ path: portraitPath, contentType: "image/jpeg" });
  });
  await page.route("**/__flagship_fixture/gift.png", async (route) => {
    await route.fulfill({ path: giftPath, contentType: "image/png" });
  });
}

test("bold event page meets contrast, targets, and axe", async ({ page }) => {
  test.setTimeout(90_000);
  const failures: string[] = [];

  for (const withImages of [true, false]) {
    await install(page, withImages);
    for (const width of widths) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
      await page.goto("/e/bold-a11y");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const report = await page.evaluate(() => {
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
        const root = document.querySelector("[data-celebration]");
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
                if (fg != null && bg != null) {
                  const ratio = contrast(fg, bg);
                  if (ratio < needed) {
                    weak.push(`${value.slice(0, 28)} ${ratio.toFixed(2)}:1 on ${bgColor}`);
                  }
                }
              }
            }
          }
          text = walker.nextNode();
        }
        return { overflow, small, weak: [...new Set(weak)].slice(0, 8) };
      });

      const label = `${withImages ? "images" : "none"} ${width}`;
      if (report.overflow > 1) failures.push(`${label} overflow ${report.overflow}`);
      if (report.small.length) failures.push(`${label} targets ${report.small.join("; ")}`);
      if (report.weak.length) failures.push(`${label} contrast ${report.weak.join("; ")}`);

      if ((width === 390 || width === 1440) && withImages === false) {
        const axe = await new AxeBuilder({ page }).include("[data-celebration]").analyze();
        const serious = axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
        if (serious.length) {
          failures.push(
            `${label} axe ${serious.map((item) => `${item.id} (${item.nodes.length})`).join(", ")}`,
          );
        }
      }
    }
    await page.unroute("**/*");
  }

  expect(failures, failures.join("\n")).toEqual([]);
});
