import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { isGuestDirectAccess } from "../lib/beta/guest-access";
import {
  giftCategory,
  IMAGE_LIBRARY,
  resolveEventCover,
  resolveGiftImage,
} from "../lib/image-library";
import { giftMotif } from "../app/e/[slug]/celebration-look";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("image library", () => {
  it("ships every manifest file under the size budget", () => {
    assert.ok(IMAGE_LIBRARY.length >= 20);
    for (const image of IMAGE_LIBRARY) {
      for (const file of [image.file, image.avif]) {
        const absolute = path.join(root, "public", file);
        assert.equal(existsSync(absolute), true, file);
        const size = statSync(absolute).size;
        const limit = image.role === "hero" ? 250_000 : 120_000;
        assert.ok(size <= limit, `${file} is ${size} bytes`);
        assert.ok(size > 1000, file);
      }
      assert.equal(image.license, "Pexels License");
      assert.equal(image.attributionRequired, false);
      assert.match(image.sourceUrl, /^https:\/\/www\.pexels\.com\/photo\/\d+\/$/);
      assert.ok(image.photographer.trim().length > 1);
      assert.ok(image.altHe.trim().length > 1);
    }
  });

  it("keeps a host image exactly and ignores the gift title", () => {
    const host = "https://cdn.example.com/hosts/cover.jpg?v=1";
    const cover = resolveEventCover({
      hostImageUrl: host,
      eventType: "יום הולדת",
      title: "יום הולדת 30",
    });
    assert.equal(cover.kind, "host");
    assert.equal(cover.src, host);
    assert.equal(cover.illustrative, false);
    assert.equal(cover.avif, "");

    const giftHost = "/uploads/gift-original.png";
    const gift = resolveGiftImage({
      hostImageUrl: giftHost,
      title: "קונסולת משחקים",
      description: "חופשה בים",
    });
    assert.equal(gift.kind, "host");
    assert.equal(gift.src, giftHost);
    assert.equal(gift.illustrative, false);
  });

  it("treats blank host fields as missing and uses the library", () => {
    const cover = resolveEventCover({
      hostImageUrl: "   ",
      eventType: "חתונה",
      title: "החתונה של דנה",
    });
    assert.equal(cover.kind, "library");
    assert.match(cover.src, /^\/images\/library\/wedding\/.+\.webp$/);
    assert.equal(cover.illustrative, false);

    const gift = resolveGiftImage({
      hostImageUrl: "",
      title: "מכונת אספרסו",
    });
    assert.equal(gift.kind, "library");
    assert.equal(gift.illustrative, true);
    assert.match(gift.src, /^\/images\/library\/coffee\/.+\.webp$/);
    assert.match(gift.avif, /\.avif$/);
  });

  it("does not map a Hebrew plural ending to travel", () => {
    assert.equal(giftCategory("קונסולת משחקים"), "gifts");
    assert.equal(giftMotif("קונסולת משחקים", 0), "gift");
    const visual = resolveGiftImage({ hostImageUrl: "", title: "קונסולת משחקים" });
    assert.equal(visual.category, "gifts");
    assert.doesNotMatch(visual.src, /travel/);
    assert.equal(giftCategory("חופשה זוגית"), "travel");
    assert.equal(giftCategory("זר כלה"), "flowers");
    assert.equal(giftCategory("שרשרת זהב"), "jewelry");
  });

  it("uses a colorful party photo when no event type is chosen", () => {
    const cover = resolveEventCover({
      hostImageUrl: "",
      eventType: "",
      title: "",
    });
    assert.equal(cover.kind, "library");
    assert.match(cover.src, /balloon-party-hero\.webp$/);
    assert.doesNotMatch(cover.src, /candle-glow/);
    assert.equal(cover.illustrative, false);
  });

  it("picks a cover from the title when the event type is empty", () => {
    const cover = resolveEventCover({
      hostImageUrl: null,
      eventType: "",
      title: "יום הולדת 40",
    });
    assert.match(cover.src, /\/birthday\//);
  });

  it("uses the floral candle cake as the birthday cover, not the balloon table", () => {
    for (const title of ["יום הולדת 30 למיכל", "יום הולדת חדש"]) {
      const cover = resolveEventCover({
        hostImageUrl: "",
        eventType: "יום הולדת",
        title,
      });
      assert.match(cover.src, /candle-layer-cake-hero\.webp$/);
      assert.equal(cover.kind, "library");
      assert.doesNotMatch(cover.src, /balloon-party/);
    }
  });

  it("leaves the showcase behind the beta gate", () => {
    assert.equal(isGuestDirectAccess("/showcase", "GET"), false);
    assert.equal(isGuestDirectAccess("/e/demo-event", "GET"), true);
  });
});
