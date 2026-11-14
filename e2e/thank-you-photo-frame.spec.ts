import { mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const artifactDir = process.env.FLAGSHIP_ARTIFACT_DIR || "/opt/cursor/artifacts";
const portraitPath = path.join(__dirname, "fixtures/flagship/portrait.jpg");

function crc32(buffer: Buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function solidPng(width: number, height: number, rgb: [number, number, number]) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const index = row + 1 + x * 3;
      raw[index] = rgb[0];
      raw[index + 1] = rgb[1];
      raw[index + 2] = rgb[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const hostFiles = {
  "/__thanks_frame/landscape.png": solidPng(1500, 1000, [40, 90, 70]),
  "/__thanks_frame/portrait.png": solidPng(800, 1200, [180, 90, 70]),
  "/__thanks_frame/square.png": solidPng(800, 800, [210, 160, 60]),
  "/__thanks_frame/near.png": solidPng(800, 1000, [70, 90, 140]),
  "/__thanks_frame/wide.png": solidPng(2400, 800, [120, 50, 40]),
  "/__thanks_frame/tall.png": solidPng(800, 2200, [40, 70, 120]),
} as const;

function eventPayload(imageUrl: string, title: string) {
  return {
    event: {
      id: "thanks-photo-id",
      slug: "thanks-photo",
      title: "חוגגים 40 לדנה",
      hostName: "נועה לוי",
      eventType: "יום הולדת",
      date: "2026-11-06",
      time: "19:00",
      venueName: "הבית של נועה",
      address: "דיזנגוף 100, תל אביב",
      message: "מתנה משותפת.",
      coverImage: "",
      giftMode: "catalog",
      moneyAmounts: [200, 350, 500],
      allowCustomAmount: true,
      moneyDisplay: "amounts",
      gifts: [
        {
          id: "gift-photo",
          eventId: "thanks-photo-id",
          title,
          description: "",
          targetAmount: 4800,
          icon: "",
          imageUrl,
          source: "custom",
          priority: 0,
          active: true,
          storeId: null,
          storeName: "",
        },
      ],
      createdAt: "2026-10-01T00:00:00.000Z",
    },
  };
}

async function installRoutes(page: Page) {
  let imageUrl = "";
  let title = "מתנה";
  await page.route("**/api/events/thanks-photo/funding", async (route) => {
    await route.fulfill({ json: { gifts: [] } });
  });
  await page.route("**/api/events/thanks-photo", async (route) => {
    await route.fulfill({ json: eventPayload(imageUrl, title) });
  });
  await page.route("**/api/orders**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ status: 405, json: { error: "read only" } });
      return;
    }
    await route.fulfill({ status: 404, json: {} });
  });
  await page.route("**/__flagship_fixture/portrait.jpg", async (route) => {
    await route.fulfill({ path: portraitPath, contentType: "image/jpeg" });
  });
  await page.route("**/__thanks_frame/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = hostFiles[pathname as keyof typeof hostFiles];
    if (!body) {
      await route.fulfill({ status: 404, body: "missing" });
      return;
    }
    await route.fulfill({ body, contentType: "image/png" });
  });
  return {
    show(nextImage: string, nextTitle: string) {
      imageUrl = nextImage;
      title = nextTitle;
    },
  };
}

async function openThanks(page: Page, width: number) {
  await page.setViewportSize({ width, height: width >= 1024 ? 980 : 844 });
  await page.goto("/e/thanks-photo/thank-you");
  await expect(page.getByRole("heading", { name: "איזה כיף, השתתפת במתנה!" })).toBeVisible();
  await expect(page.locator("[data-journey-thanks-photo] [data-journey-photo]")).toBeVisible();
  await expect
    .poll(async () =>
      page.locator("[data-journey-thanks-photo] [data-journey-frame]").getAttribute("data-fit"),
    )
    .not.toBe("pending");
  await expect
    .poll(async () =>
      page
        .locator("[data-journey-thanks-photo] [data-journey-photo]")
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
}

async function frameReport(page: Page) {
  return page.locator("[data-journey-thanks-photo] [data-journey-frame]").evaluate((frame) => {
    const photo = frame.querySelector("[data-journey-photo]");
    const backdrop = frame.querySelector("[data-journey-backdrop]");
    if (!(photo instanceof HTMLImageElement) || photo.naturalWidth <= 0) {
      return null;
    }
    const frameRect = frame.getBoundingClientRect();
    const imgRect = photo.getBoundingClientRect();
    const padX = frame.clientWidth;
    const padY = frame.clientHeight;
    const style = getComputedStyle(photo);
    const ratio = photo.naturalWidth / photo.naturalHeight;
    const elemRatio = imgRect.width / imgRect.height;
    let contentW = imgRect.width;
    let contentH = imgRect.height;
    if (style.objectFit === "contain" && ratio > 0 && elemRatio > 0) {
      if (ratio > elemRatio) {
        contentH = imgRect.width / ratio;
      } else {
        contentW = imgRect.height * ratio;
      }
    }
    const scale =
      style.objectFit === "contain"
        ? Math.min(imgRect.width / photo.naturalWidth, imgRect.height / photo.naturalHeight)
        : Math.max(imgRect.width / photo.naturalWidth, imgRect.height / photo.naturalHeight);
    const cropX = 1 - imgRect.width / scale / photo.naturalWidth;
    const cropY = 1 - imgRect.height / scale / photo.naturalHeight;
    const backdropRect = backdrop instanceof HTMLImageElement ? backdrop.getBoundingClientRect() : null;
    return {
      fit: style.objectFit,
      dataFit: frame.getAttribute("data-fit"),
      position: style.objectPosition,
      aspect: getComputedStyle(frame).aspectRatio,
      cropX,
      cropY,
      barX: Math.max(0, imgRect.width - contentW) / imgRect.width,
      barY: Math.max(0, imgRect.height - contentH) / imgRect.height,
      insetX: Math.abs(padX - imgRect.width),
      insetY: Math.abs(padY - imgRect.height),
      label: frame.querySelector("[data-illustrative-label]")?.textContent ?? "",
      source: photo.getAttribute("data-image-source"),
      src: photo.getAttribute("src") ?? "",
      backdrop: Boolean(backdropRect && backdropRect.width > frameRect.width * 0.9),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

test("thank-you frame keeps cutouts whole and fills scene photos", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(artifactDir, { recursive: true });
  const routes = await installRoutes(page);
  const failures: string[] = [];

  async function check(name: string, width: number, assert: (report: NonNullable<Awaited<ReturnType<typeof frameReport>>>) => string | null) {
    await openThanks(page, width);
    const report = await frameReport(page);
    if (!report) {
      failures.push(`${name} ${width} missing frame`);
      return;
    }
    if (report.overflow > 1) {
      failures.push(`${name} ${width} overflow ${report.overflow}`);
    }
    const problem = assert(report);
    if (problem) {
      failures.push(`${name} ${width} ${problem} ${JSON.stringify(report)}`);
    }
    if (width === 390 || width === 1440) {
      const axe = await new AxeBuilder({ page }).include(".guest-shell").analyze();
      const serious = axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
      if (serious.length) {
        failures.push(`${name} ${width} axe ${serious.map((item) => item.id).join(", ")}`);
      }
    }
  }

  for (const width of [390, 1440]) {
    routes.show("/demo/espresso.png", "מכונת אספרסו פרימיום");
    await check("espresso", width, (report) => {
      if (report.source !== "host" || report.label || !report.src.includes("/demo/espresso.png")) return "source";
      if (report.dataFit !== "contain" || report.fit !== "contain") return "fit";
      if (report.cropX > 0.02 || report.cropY > 0.02) return "cropped the cutout";
      if (report.aspect.replace(/\s/g, "") !== "4/5") return "aspect";
      return null;
    });
    await page.screenshot({
      path: path.join(artifactDir, `thanks-after-espresso-${width}.png`),
      fullPage: true,
    });

    routes.show("", "מכונת קפה");
    await check("library", width, (report) => {
      if (report.source !== "library" || !report.src.includes("kitchen-machine")) return "not the kitchen photo";
      if (report.dataFit !== "cover" || report.fit !== "cover") return "fit";
      if (report.barX > 0.04 || report.barY > 0.04) return "bars";
      if (report.cropX > 0.04 || report.cropY > 0.04) return "crop";
      if (report.insetX > 4 || report.insetY > 4) return "inset";
      if (!report.position.includes("62%")) return "focal";
      if (report.label !== "תמונה להמחשה") return "label";
      return null;
    });
    await page.screenshot({
      path: path.join(artifactDir, `thanks-after-library-landscape-${width}.png`),
      fullPage: true,
    });

    routes.show("/images/library/coffee/kitchen-machine-card.avif", "מכונת קפה");
    await check("host-landscape", width, (report) => {
      if (report.source !== "host" || report.label) return "host should win without the illustrative label";
      if (report.dataFit !== "cover" || report.fit !== "cover") return "fit";
      if (report.barX > 0.04 || report.barY > 0.04 || report.cropX > 0.04 || report.cropY > 0.04) return "bars or crop";
      return null;
    });
    await page.screenshot({
      path: path.join(artifactDir, `thanks-after-host-landscape-${width}.png`),
      fullPage: true,
    });

    routes.show("/__flagship_fixture/portrait.jpg", "דיוקן");
    await check("host-portrait", width, (report) => {
      if (report.source !== "host" || report.label) return "label";
      if (report.dataFit !== "cover" || report.fit !== "cover") return "fit";
      if (report.barX > 0.04 || report.barY > 0.04 || report.cropX > 0.04 || report.cropY > 0.04) return "bars or crop";
      if (!report.aspect.includes("960") && !report.aspect.startsWith("0.66")) return "aspect";
      return null;
    });
    await page.screenshot({
      path: path.join(artifactDir, `thanks-after-host-portrait-${width}.png`),
      fullPage: true,
    });
  }

  routes.show("", "עוגת שכבות");
  await check("library-default", 390, (report) => {
    if (report.source !== "library" || report.label !== "תמונה להמחשה") return "library label";
    if (report.dataFit !== "cover" || report.fit !== "cover") return "fit";
    if (report.barX > 0.04 || report.barY > 0.04 || report.cropX > 0.04 || report.cropY > 0.04) return "bars or crop";
    return null;
  });

  routes.show("/__thanks_frame/landscape.png", "נוף");
  await check("host-wide", 390, (report) => {
    if (report.label || report.source !== "host") return "label";
    if (report.dataFit !== "cover" || report.fit !== "cover") return "fit";
    if (report.barX > 0.04 || report.barY > 0.04 || report.cropX > 0.04 || report.cropY > 0.04) return "bars or crop";
    return null;
  });

  routes.show("/__thanks_frame/portrait.png", "פורטרט");
  await check("host-tallish", 390, (report) => {
    if (report.dataFit !== "cover" || report.fit !== "cover") return "fit";
    if (report.barX > 0.04 || report.barY > 0.04 || report.cropX > 0.04 || report.cropY > 0.04) return "bars or crop";
    return null;
  });

  routes.show("/__thanks_frame/square.png", "ריבוע");
  await check("host-square", 390, (report) => {
    if (report.dataFit !== "cover" || report.fit !== "cover") return "fit";
    if (report.barX > 0.04 || report.barY > 0.04 || report.cropX > 0.04 || report.cropY > 0.04) return "bars or crop";
    if (report.aspect.replace(/\s/g, "") !== "1/1") return "aspect";
    return null;
  });
  await check("host-square", 1440, (report) => {
    if (report.dataFit !== "cover" || report.overflow > 1) return "desktop";
    if (report.barX > 0.04 || report.barY > 0.04) return "bars";
    return null;
  });

  routes.show("/__thanks_frame/near.png", "קרוב");
  await check("host-near", 390, (report) => {
    if (report.dataFit !== "cover" || report.fit !== "cover") return "fit";
    if (report.aspect.replace(/\s/g, "") !== "4/5") return "aspect";
    if (report.cropX > 0.04 || report.cropY > 0.04) return "crop";
    return null;
  });

  routes.show("/__thanks_frame/wide.png", "פנורמה");
  await check("host-wide-extreme", 390, (report) => {
    if (report.dataFit !== "mat" || report.fit !== "contain" || !report.backdrop) return "mat";
    if (report.cropX > 0.02 || report.cropY > 0.02) return "cropped the panorama";
    if (report.label) return "label";
    return null;
  });

  routes.show("/__thanks_frame/tall.png", "גבוה");
  await check("host-tall-extreme", 1440, (report) => {
    if (report.dataFit !== "mat" || report.fit !== "contain" || !report.backdrop) return "mat";
    if (report.cropX > 0.02 || report.cropY > 0.02) return "cropped the tall photo";
    return null;
  });

  expect(failures, failures.join("\n")).toEqual([]);
});
