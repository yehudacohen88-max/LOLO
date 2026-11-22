import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ARTIFACTS = "/opt/cursor/artifacts/host-closing";
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440] as const;

const scenes = [
  ["/host/example?view=zero", "zero-orders", "אין הזמנות עדיין"],
  ["/host/example?view=nogoal", "no-goal", "אין יעד כולל למתנות באירוע."],
  ["/host/example?view=many", "many-orders", "משתתףעםשםארוךמאודבלירווחיםמספר1"],
  ["/host/example?view=ratios", "ratios", "תמונות ביחסים שונים"],
] as const;

function shot(page: Page, name: string) {
  mkdirSync(ARTIFACTS, { recursive: true });
  return page.screenshot({ path: `${ARTIFACTS}/${name}.png`, fullPage: true });
}

test.describe("host closing edge cases", () => {
  test.describe.configure({ timeout: 180_000 });

  test("edge dashboards stay in frame and are readable", async ({ page }) => {
    const failures: string[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
      for (const [url, name, marker] of scenes) {
        await page.goto(url);
        await expect(page.getByText(marker).first()).toBeVisible();
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
});
