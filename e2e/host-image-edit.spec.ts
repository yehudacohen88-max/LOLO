import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ARTIFACTS = "/opt/cursor/artifacts/bold-final";
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440] as const;
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABLAAEBAAAAAAAAAAAAAAAAAAAABgEBAAAAAAAAAAAAAAAAAAAABhABAAAAAAAAAAAAAAAAAAAAABEBAAAAAAAAAAAAAAAAAAAAAP/AABEIAAgACAMBIgACEQADEQD/2gAMAwEAAhEDEQA/ALcApHn/2Q==",
  "base64",
);

function shot(page: Page, name: string) {
  mkdirSync(ARTIFACTS, { recursive: true });
  return page.screenshot({ path: `${ARTIFACTS}/${name}.png`, fullPage: true });
}

test.describe("final bold screens and host image edit", () => {
  test.describe.configure({ timeout: 120_000 });

  test("an unset event uses the colorful party cover", async ({ page }) => {
    await page.goto("/create-event/preview");
    const cover = page.locator("[data-image-source='library']:visible").first();
    await expect(cover).toHaveAttribute("src", /balloon-party-hero\.webp/);
    await expect(page.locator("[data-image-source='library'][src*='candle-glow']")).toHaveCount(0);
  });

  test("home, preview, and the host dashboard stay in frame", async ({ page }) => {
    const failures: string[] = [];
    const targets = [
      ["/", "home"],
      ["/create-event/preview", "preview"],
      ["/host/example", "host-dashboard"],
    ] as const;
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
      for (const [url, name] of targets) {
        await page.goto(url);
        const extra = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        if (extra > 1) failures.push(`${name} ${width} overflow ${extra}`);
        if (width === 390 || width === 1440) {
          await shot(page, `${name}-${width}`);
          const axe = await new AxeBuilder({ page }).analyze();
          const serious = axe.violations.filter(
            (item) => item.impact === "serious" || item.impact === "critical",
          );
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

  test("the host dashboard can replace a cover and revert to the library", async ({ page }) => {
    for (const width of [390, 1440] as const) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
      await page.goto("/host/example");
      const overview = page.locator("section").filter({
        has: page.getByRole("heading", { name: "סקירת האירוע" }),
      });
      await expect(overview.locator("[data-image-source='library']")).toHaveAttribute(
        "src",
        /candle-layer-cake-hero\.webp/,
      );
      await expect(overview.locator("[data-illustrative-label]")).toHaveCount(0);
      await shot(page, `host-replace-default-${width}`);

      await overview.locator('input[type="file"]').setInputFiles({
        name: "cover.jpg",
        mimeType: "image/jpeg",
        buffer: TINY_JPEG,
      });
      await expect(overview.locator("[data-image-source='host']")).toBeVisible();
      await expect(overview.locator("[data-illustrative-label]")).toHaveCount(0);
      await shot(page, `host-replace-upload-${width}`);

      await overview.getByRole("button", { name: "הסרת תמונה" }).click();
      await expect(overview.locator("[data-image-source='library']")).toHaveAttribute(
        "src",
        /candle-layer-cake-hero\.webp/,
      );
      await expect(overview.locator("[data-image-source='host']")).toHaveCount(0);
      await shot(page, `host-replace-revert-${width}`);
    }

    const gifts = page.locator("section").filter({
      has: page.getByRole("heading", { name: "התקדמות המתנות" }),
    });
    await expect(gifts.locator("[data-illustrative-label]")).toHaveText("תמונה להמחשה");
  });
});
