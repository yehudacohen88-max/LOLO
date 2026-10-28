import { expect, type Page } from "@playwright/test";

export async function expectGiftFallback(page: Page) {
  const tiles = page.locator("[data-gift-fallback]");
  await expect(tiles.first()).toBeVisible();
  await expect(page.locator("[data-empty-letter]")).toHaveCount(0);
  await expect(page.locator("[data-empty-bow]")).toHaveCount(0);
  const count = await tiles.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const box = await tiles.nth(index).boundingBox();
    if (!box || box.width < 8) {
      continue;
    }
    const ratio = box.width / box.height;
    if (box.width <= 120) {
      expect(ratio).toBeGreaterThan(0.85);
      expect(ratio).toBeLessThan(1.15);
    } else if (box.height <= 180) {
      expect(box.height).toBeGreaterThan(80);
    } else {
      expect(ratio).toBeGreaterThan(1.4);
      expect(ratio).toBeLessThan(1.8);
    }
  }
  const overflow = await tiles.first().evaluate((element) => {
    const tile = element.getBoundingClientRect();
    const glyph = element.querySelector("svg")?.getBoundingClientRect();
    if (!glyph) {
      return true;
    }
    return (
      glyph.left < tile.left - 1 ||
      glyph.right > tile.right + 1 ||
      glyph.top < tile.top - 1 ||
      glyph.bottom > tile.bottom + 1
    );
  });
  expect(overflow).toBe(false);
}

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
