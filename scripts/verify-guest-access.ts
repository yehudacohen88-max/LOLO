import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGuestDirectAccess, isPublicEventSlug } from "../lib/beta/guest-access";
import { GUEST_EVENT_FIELDS } from "../lib/events/guest-shape";
import {
  forbiddenPublicKeys,
  PUBLIC_FUNDING_GIFT_KEYS,
  PUBLIC_GIFT_KEYS,
  PUBLIC_INVITE_KEYS,
  PUBLIC_ORDER_ITEM_KEYS,
  PUBLIC_ORDER_KEYS,
  PUBLIC_QUOTE_KEYS,
  toPublicFunding,
  toPublicGuestEvent,
  toPublicInviteIdentity,
  toPublicOrder,
  toPublicPaymentStart,
  toPublicQuote,
} from "../lib/events/public-guest";
import { buildDemoEvent } from "../lib/events/demo";
import { canonicalEventSlug, normalizeEventSlug } from "../lib/events/slug";
import {
  createUniqueSlug,
  SLUG_SUFFIX_ALPHABET,
  SLUG_SUFFIX_LENGTH,
} from "../lib/events/slug-mint";
import { quoteContribution } from "../lib/orders/repository";
import {
  GUEST_LIMITS,
  beginGuestRead,
  guestMissLocked,
  noteGuestMiss,
  resetGuestLimits,
  takeOrderWrite,
  takePaymentIp,
  takePaymentSlug,
} from "../lib/security/guest-limit";
import { clientIpFromVercelHeaders } from "../lib/security/client-ip";
import {
  GUEST_EVENT_MISS,
  GUEST_ORDER_MISS,
  GUEST_RATE_LIMIT_IDS,
  guestEventLookup,
  guestRateLimitKey,
  sharedLimitDecision,
} from "../lib/security/guest-rate-decision";
import { demoBrowserConfirmEnabled } from "../lib/payments/selection";
import type { EventFunding } from "../lib/funding/calculate";
import type { StoredEvent } from "../lib/events/types";
import type { StoredOrder } from "../lib/orders/types";

const NOW = 1_700_000_000_000;

describe("guest direct access allowlist", () => {
  const allowed: Array<[string, string]> = [
    ["GET", "/e/demo-event"],
    ["HEAD", "/e/demo-event"],
    ["GET", "/e/birthday-ab12"],
    ["GET", "/e/birthday-ab12/greeting"],
    ["GET", "/e/birthday-ab12/details"],
    ["GET", "/e/birthday-ab12/payment"],
    ["GET", "/e/birthday-ab12/thank-you"],
    ["GET", "/i/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["GET", "/i/short"],
    ["GET", "/e/Birthday-AB12"],
    ["GET", "/E/demo-event"],
    ["GET", "/api/events/Birthday-AB12"],
    ["GET", "/api/events/demo-event"],
    ["GET", "/api/events/birthday-ab12/funding"],
    ["GET", "/api/orders"],
    ["POST", "/api/orders"],
    ["POST", "/api/checkout/quote"],
    ["POST", "/api/payments/start"],
    ["POST", "/api/payments/confirm"],
    ["GET", "/api/invite/identity"],
  ];

  const denied: Array<[string, string]> = [
    ["POST", "/e/demo-event"],
    ["GET", "/"],
    ["GET", "/create-event"],
    ["GET", "/create-event/details"],
    ["GET", "/host"],
    ["GET", "/host/events/abc"],
    ["GET", "/admin"],
    ["GET", "/store"],
    ["GET", "/v/example"],
    ["GET", "/design-preview/home"],
    ["POST", "/api/events"],
    ["POST", "/api/events/demo-event"],
    ["GET", "/api/events/demo-event/funding/extra"],
    ["GET", "/api/uploads/images"],
    ["POST", "/api/uploads/images"],
    ["POST", "/api/host/login"],
    ["GET", "/api/host/events/abc/guests"],
    ["POST", "/api/admin/login"],
    ["POST", "/api/store/login"],
    ["GET", "/api/stores"],
    ["GET", "/api/checkout/quote"],
    ["GET", "/api/payments/confirm"],
    ["POST", "/api/invite/identity"],
    ["GET", "/e/demo-event/extra"],
    ["GET", "/e/../admin"],
    ["GET", "/e/%2e%2e/admin"],
    ["GET", "/api/events/../admin"],
    ["GET", "/i/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/extra"],
    ["GET", "/i/../../admin"],
  ];

  for (const [method, pathname] of allowed) {
    it(`allows ${method} ${pathname}`, () => {
      assert.equal(isGuestDirectAccess(pathname, method), true);
    });
  }

  for (const [method, pathname] of denied) {
    it(`keeps ${method} ${pathname} behind the beta gate`, () => {
      assert.equal(isGuestDirectAccess(pathname, method), false);
    });
  }
});

describe("event slug minting", () => {
  it("mints a long crypto suffix and still accepts the old short form", () => {
    const existing = ["birthday-ab12", "demo-event"];
    const created = createUniqueSlug("Birthday Party", existing);
    const suffix = created.slice(created.lastIndexOf("-") + 1);

    assert.match(created, /^birthday-party-[abcdefghijkmnopqrstuvwxyz23456789]{10}$/);
    assert.equal(suffix.length, SLUG_SUFFIX_LENGTH);
    assert.equal([...suffix].every((char) => SLUG_SUFFIX_ALPHABET.includes(char)), true);
    assert.equal(existing.includes(created), false);
    assert.equal(normalizeEventSlug("birthday-ab12"), "birthday-ab12");
    assert.equal(isPublicEventSlug("birthday-ab12"), true);
    assert.equal(isPublicEventSlug(created), true);
    assert.equal(
      existing.find((slug) => normalizeEventSlug(slug) === "birthday-ab12"),
      "birthday-ab12",
    );
  });
});

describe("guest rate limits", () => {
  it("returns a block after the per-IP event read cap", () => {
    resetGuestLimits();
    for (let count = 0; count < GUEST_LIMITS.readPerIp; count += 1) {
      assert.equal(beginGuestRead("203.0.113.10", NOW).ok, true);
    }
    const blocked = beginGuestRead("203.0.113.10", NOW);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.ok(blocked.retryAfterSeconds >= 1);
    }
    assert.equal(beginGuestRead("203.0.113.11", NOW).ok, true);
  });

  it("locks an address after repeated event misses", () => {
    resetGuestLimits();
    for (let count = 0; count < GUEST_LIMITS.missPerIp; count += 1) {
      noteGuestMiss("203.0.113.20", NOW);
    }
    assert.equal(guestMissLocked("203.0.113.20", NOW).ok, false);
    assert.equal(beginGuestRead("203.0.113.20", NOW).ok, false);
    assert.equal(
      beginGuestRead("203.0.113.20", NOW + GUEST_LIMITS.missLockMs + 1).ok,
      true,
    );
  });

  it("caps order writes per address and per event", () => {
    resetGuestLimits();
    for (let count = 0; count < GUEST_LIMITS.orderPerIp; count += 1) {
      assert.equal(takeOrderWrite("203.0.113.30", "party-oldslug1", NOW).ok, true);
    }
    assert.equal(takeOrderWrite("203.0.113.30", "party-oldslug1", NOW).ok, false);
    assert.equal(takeOrderWrite("203.0.113.31", "party-oldslug1", NOW).ok, true);

    resetGuestLimits();
    for (let count = 0; count < GUEST_LIMITS.orderPerSlug; count += 1) {
      assert.equal(takeOrderWrite(`198.51.100.${count % 200}`, "wedding-slug01", NOW).ok, true);
    }
    assert.equal(takeOrderWrite("198.51.100.250", "wedding-slug01", NOW).ok, false);
  });

  it("caps payment attempts per address and per event", () => {
    resetGuestLimits();
    for (let count = 0; count < GUEST_LIMITS.paymentPerIp; count += 1) {
      assert.equal(takePaymentIp("203.0.113.40", NOW).ok, true);
    }
    assert.equal(takePaymentIp("203.0.113.40", NOW).ok, false);
    for (let count = 0; count < GUEST_LIMITS.paymentPerSlug; count += 1) {
      assert.equal(takePaymentSlug("party-slug0001", NOW).ok, true);
    }
    assert.equal(takePaymentSlug("party-slug0001", NOW).ok, false);
  });
});

describe("guest response allowlist", () => {
  it("drops host secrets and other people's contact fields", () => {
    const poisoned = {
      ...buildDemoEvent(),
      accessCode: "host-code",
      codeHash: "hash",
      hostSession: "session",
    } as StoredEvent;
    const event = toPublicGuestEvent(poisoned);
    assert.deepEqual(Object.keys(event), [...GUEST_EVENT_FIELDS]);
    assert.deepEqual(Object.keys(event.gifts[0] ?? {}), [...PUBLIC_GIFT_KEYS]);
    assert.equal(event.gifts[0]?.storeId, null);
    assert.deepEqual(forbiddenPublicKeys({ event }), []);

    const funding = toPublicFunding({
      paidAmount: 10,
      pendingAmount: 5,
      paidOrderCount: 1,
      pendingOrderCount: 1,
      gifts: [
        {
          giftId: "gift-1",
          raisedAmount: 10,
          pendingAmount: 5,
          contributorCount: 1,
          percentOfTarget: 10,
        },
      ],
      contributors: [{ name: "דנה", email: "dana@example.com", greetingText: "מזל טוב" }],
    } as EventFunding & {
      contributors: Array<{ name: string; email: string; greetingText: string }>;
    });
    assert.deepEqual(Object.keys(funding), ["gifts"]);
    assert.deepEqual(Object.keys(funding.gifts[0] ?? {}), [...PUBLIC_FUNDING_GIFT_KEYS]);
    assert.equal(JSON.stringify(funding).includes("דנה"), false);
    assert.deepEqual(forbiddenPublicKeys(funding), []);

    const order = toPublicOrder({
      id: "order-1",
      eventId: "event-1",
      eventSlug: "birthday-ab12",
      guestName: "יעל",
      totalAmount: 100,
      contributionAmount: 100,
      feeAmount: 0,
      chargedAmount: 100,
      paymentStatus: "pending",
      paymentProvider: null,
      paymentReference: null,
      paidAt: null,
      accessToken: "11111111-1111-4111-8111-111111111111",
      items: [{ giftId: "gift-1", giftName: "מתנה", amount: 100 }],
      guestPhone: "0500000000",
      guestEmail: "yael@example.com",
      greetingText: "ברכה",
      accessCode: "secret",
    } as StoredOrder & {
      guestPhone: string;
      guestEmail: string;
      greetingText: string;
      accessCode: string;
    });
    assert.deepEqual(Object.keys(order), [...PUBLIC_ORDER_KEYS]);
    assert.deepEqual(Object.keys(order.items[0] ?? {}), [...PUBLIC_ORDER_ITEM_KEYS]);
    assert.equal(order.accessToken, "11111111-1111-4111-8111-111111111111");
    assert.deepEqual(forbiddenPublicKeys(order), []);

    const quote = toPublicQuote({
      contributionAmount: 100,
      feeAmount: 0,
      chargedAmount: 100,
      feeEnabled: false,
      provider: "demo",
      isDemo: true,
    });
    assert.deepEqual(Object.keys(quote), [...PUBLIC_QUOTE_KEYS]);

    const started = toPublicPaymentStart({
      provider: "demo",
      isDemo: true,
      orderId: order.id,
      status: "ready",
      contributionAmount: 100,
      feeAmount: 0,
      chargedAmount: 100,
    });
    assert.equal("checkoutUrl" in started, false);

    const identityInput = {
      name: "נועה",
      phone: "0501234567",
      email: "hidden@example.com",
    };
    const identity = toPublicInviteIdentity(identityInput);
    assert.deepEqual(Object.keys(identity), [...PUBLIC_INVITE_KEYS]);
    assert.equal(JSON.stringify(identity).includes("hidden@example.com"), false);
  });
});

describe("guest money caps and demo confirm", () => {
  it("rejects an oversized contribution before any payment provider runs", async () => {
    await assert.rejects(
      () => quoteContribution("demo-event", [{ giftId: "demo-espresso", amount: 100_001 }]),
      /הסכום גבוה מהמותר/,
    );
    const quote = await quoteContribution("demo-event", [
      { giftId: "demo-espresso", amount: 200 },
    ]);
    assert.equal(quote.contributionAmount, 200);
  });

  it("allows browser confirm only while the provider is the demo default", () => {
    assert.equal(demoBrowserConfirmEnabled(undefined), true);
    assert.equal(demoBrowserConfirmEnabled(""), true);
    assert.equal(demoBrowserConfirmEnabled("demo"), true);
    assert.equal(demoBrowserConfirmEnabled("none"), false);
    assert.equal(demoBrowserConfirmEnabled("cardcom"), false);
  });
});

describe("guest client IP", () => {
  function headers(values: Record<string, string>) {
    return {
      get(name: string) {
        return values[name.toLowerCase()] ?? null;
      },
    };
  }

  it("ignores a spoofed x-forwarded-for when Vercel set the client address", () => {
    assert.equal(
      clientIpFromVercelHeaders(
        headers({
          "x-forwarded-for": "1.2.3.4, 203.0.113.10",
          "x-real-ip": "203.0.113.50",
        }),
      ),
      "203.0.113.50",
    );
    assert.equal(
      clientIpFromVercelHeaders(
        headers({
          "x-forwarded-for": "1.2.3.4",
          "x-vercel-forwarded-for": "198.51.100.8, 10.0.0.1",
          "x-real-ip": "203.0.113.50",
        }),
      ),
      "198.51.100.8",
    );
  });

  it("does not treat a lone spoofed x-forwarded-for as the client", () => {
    assert.equal(
      clientIpFromVercelHeaders(headers({ "x-forwarded-for": "1.2.3.4" })),
      "unknown",
    );
    assert.equal(clientIpFromVercelHeaders(headers({})), "unknown");
    assert.equal(
      clientIpFromVercelHeaders(headers({ "x-real-ip": "x".repeat(129) })),
      "unknown",
    );
  });
});

describe("guest enumeration responses", () => {
  it("uses one body for a malformed slug, a missing event, and a non-public row", () => {
    const malformed = guestEventLookup({ slug: "Not A Slug", found: false, visible: false });
    const missing = guestEventLookup({ slug: "birthday-ab12", found: false, visible: false });
    const hidden = guestEventLookup({ slug: "Birthday-AB12", found: true, visible: false });
    assert.equal(malformed.status, 404);
    assert.deepEqual(malformed, missing);
    assert.deepEqual(missing, hidden);
    assert.equal(JSON.stringify(malformed.body), JSON.stringify(GUEST_EVENT_MISS));
    assert.equal(JSON.stringify(GUEST_ORDER_MISS), JSON.stringify({ error: "ההזמנה לא נמצאה." }));
  });

  it("canonicalizes mixed-case slugs before the public-shape check", () => {
    assert.equal(canonicalEventSlug("Birthday-AB12"), "birthday-ab12");
    assert.equal(isPublicEventSlug("Birthday-AB12"), true);
    assert.equal(isPublicEventSlug("not a slug"), false);
    const visible = guestEventLookup({ slug: "Birthday-AB12", found: true, visible: true });
    assert.equal(visible.status, 200);
    assert.equal(visible.body, null);
  });
});

describe("shared guest rate limit decision", () => {
  it("keys reads by IP and writes by IP plus event id", () => {
    assert.equal(GUEST_RATE_LIMIT_IDS.read, "lolo-guest-read");
    assert.equal(GUEST_RATE_LIMIT_IDS.write, "lolo-guest-write");
    assert.equal(guestRateLimitKey("203.0.113.10", "read"), "203.0.113.10");
    assert.equal(guestRateLimitKey("203.0.113.10", "write", "event-1"), "203.0.113.10:event-1");
    assert.equal(guestRateLimitKey("203.0.113.10", "write"), "203.0.113.10:none");
  });

  it("fails closed on Vercel for a timeout or firewall error and skips the shared store off Vercel", () => {
    assert.deepEqual(sharedLimitDecision({ onVercel: false, result: { failed: true } }), { ok: true });
    assert.deepEqual(sharedLimitDecision({ onVercel: true }), {
      ok: false,
      retryAfterSeconds: 60,
    });
    assert.deepEqual(sharedLimitDecision({ onVercel: true, result: { failed: true } }), {
      ok: false,
      retryAfterSeconds: 60,
    });
    assert.deepEqual(
      sharedLimitDecision({ onVercel: true, result: { rateLimited: true, error: "blocked" } }),
      { ok: false, retryAfterSeconds: 60 },
    );
    assert.deepEqual(sharedLimitDecision({ onVercel: true, result: { rateLimited: true } }), {
      ok: false,
      retryAfterSeconds: 60,
    });
    assert.deepEqual(
      sharedLimitDecision({ onVercel: true, result: { rateLimited: false, error: "not-found" } }),
      { ok: true },
    );
    assert.deepEqual(sharedLimitDecision({ onVercel: true, result: { rateLimited: false } }), {
      ok: true,
    });
  });
});
