import { expect, type Page } from "@playwright/test";

export async function expectLetterClearOfBow(page: Page) {
  const letters = page.locator("[data-empty-letter]");
  const bows = page.locator("[data-empty-bow]");
  await expect(letters.first()).toBeVisible();
  await expect(bows.first()).toBeVisible();
  const count = await letters.count();
  expect(count).toBeGreaterThan(0);
  expect(await bows.count()).toBe(count);

  let visible = 0;
  for (let index = 0; index < count; index += 1) {
    const letterBox = await letters.nth(index).boundingBox();
    const bowBox = await bows.nth(index).boundingBox();
    if (!letterBox || !bowBox) {
      continue;
    }
    visible += 1;
    const overlaps =
      letterBox.y < bowBox.y + bowBox.height &&
      letterBox.y + letterBox.height > bowBox.y &&
      letterBox.x < bowBox.x + bowBox.width &&
      letterBox.x + letterBox.width > bowBox.x;
    expect(overlaps).toBe(false);
  }
  expect(visible).toBeGreaterThan(0);
}
