import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import {
  planEventEdit,
  type EventEditCurrent,
  type EventEditGift,
  type EventEditLock,
} from "../lib/host/event-edit";
import { createHostIdentityToken, readHostIdentityToken } from "../lib/host/identity-session";
import { maskEmail, toHostEventSummary } from "../lib/host/identity-public";
import { buildInvitationMessage } from "../lib/host/invitation-message";
import { hashOneTimeCode, oneTimeCodeMatches } from "../lib/host/one-time-code";
import {
  clearRecoveryIpLimits,
  clearSimulatedHostNotices,
  deliverSimulatedHostNotice,
  noteRecoveryIp,
  planRecoveryConfirm,
  readSimulatedHostNotices,
  RECOVERY_MISMATCH,
  recoveryNoticeBody,
  recoverySendDecision,
  recoveryStartPayload,
} from "../lib/host/recovery-flow";
import { createHostSessionToken, readHostSessionToken } from "../lib/host/session";
import { hostSessionVersionMatches } from "../lib/host/session-version";
import {
  guestCanCancel,
  guestCanRequestRefund,
  guestCancelLine,
  guestPaymentStatusLabel,
  guestRefundLine,
  guestRefundRemaining,
} from "../lib/orders/guest-status";

const GIFT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GIFT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STORE_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STORE_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function gift(id: string, storeId: string | null = null): EventEditGift {
  return {
    id,
    title: "מתנה",
    description: "תיאור",
    targetAmount: 100,
    icon: "🎁",
    imageUrl: "",
    storeId,
    priority: 0,
    active: true,
  };
}

function current(): EventEditCurrent {
  return {
    slug: "event-ab12",
    title: "יום הולדת",
    hostName: "נועה",
    eventType: "יום הולדת",
    date: "2026-11-12",
    time: "19:30",
    venueName: "הבית",
    address: "הרצל 1",
    message: "מחכים",
    coverImage: "",
    gifts: [gift(GIFT_A, STORE_A), gift(GIFT_B)],
  };
}

function edit(patch: Record<string, unknown>, locks: EventEditLock[] = []) {
  return planEventEdit({
    current: current(),
    patch,
    locks,
    includeGreeting: "invitationGreeting" in patch,
    coverIsUpload: (url) => url.startsWith("https://uploads.example/"),
    imageIsUpload: (url) => url.startsWith("https://uploads.example/"),
    newGiftId: () => "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  });
}

describe("host event edit", () => {
  it("keeps the guest slug and does not delete a gift that has orders", () => {
    const renamed = edit({ slug: "other-event", title: "שם חדש" });
    assert.equal(renamed.ok, false);
    if (!renamed.ok) {
      assert.equal(renamed.error, "קישור האורחים נשאר קבוע.");
    }

    const kept = edit({ title: "שם חדש" });
    assert.equal(kept.ok, true);
    if (kept.ok) {
      assert.equal(kept.plan.details.title, "שם חדש");
      assert.equal(Object.hasOwn(kept.plan.details, "slug"), false);
      assert.equal(kept.plan.gifts, null);
      assert.deepEqual(kept.plan.removeIds, []);
    }

    const removed = edit(
      { gifts: [{ id: GIFT_B, title: "נשארת", targetAmount: 100, storeId: null, active: true }] },
      [{ id: GIFT_A, orderCount: 2, paidAmount: 40, voucherCount: 0 }],
    );
    assert.equal(removed.ok, false);
    if (!removed.ok) {
      assert.match(removed.error, /הזמנות/);
    }
  });

  it("blocks a store change and a target change when money or a voucher exists", () => {
    const store = edit(
      {
        gifts: [
          { id: GIFT_A, title: "מתנה", targetAmount: 100, storeId: STORE_B, active: true },
          { id: GIFT_B, title: "מתנה", targetAmount: 100, storeId: null, active: true },
        ],
      },
      [{ id: GIFT_A, orderCount: 1, paidAmount: 40, voucherCount: 1 }],
    );
    assert.equal(store.ok, false);
    if (!store.ok) {
      assert.match(store.error, /חנות/);
    }

    const target = edit(
      {
        gifts: [
          { id: GIFT_A, title: "מתנה", targetAmount: 250, storeId: STORE_A, active: true },
          { id: GIFT_B, title: "מתנה", targetAmount: 100, storeId: null, active: true },
        ],
      },
      [{ id: GIFT_A, orderCount: 1, paidAmount: 40, voucherCount: 0 }],
    );
    assert.equal(target.ok, false);

    const text = edit(
      {
        gifts: [
          { id: GIFT_A, title: "שם חדש", description: "עודכן", targetAmount: 100, storeId: STORE_A, active: true },
          { id: GIFT_B, title: "מתנה", targetAmount: 100, storeId: null, active: true },
        ],
      },
      [{ id: GIFT_A, orderCount: 1, paidAmount: 40, voucherCount: 1 }],
    );
    assert.equal(text.ok, true);
    if (text.ok && text.plan.gifts) {
      assert.equal(text.plan.gifts[0]?.title, "שם חדש");
      assert.equal(text.plan.gifts[0]?.storeId, STORE_A);
      assert.deepEqual(text.plan.removeIds, []);
    }
  });

  it("does not mint a slug from the old client update", () => {
    const repository = readFileSync(new URL("../lib/events/repository.ts", import.meta.url), "utf8");
    const updateFn = repository.slice(repository.indexOf("export async function updateEvent"));
    assert.doesNotMatch(updateFn, /createEvent/);
    const writer = readFileSync(new URL("../lib/host/event-edit-server.ts", import.meta.url), "utf8");
    const eventPatch = writer.slice(writer.indexOf("const eventPatch"), writer.indexOf("const saved"));
    assert.match(writer, /planEventEdit/);
    assert.doesNotMatch(eventPatch, /slug/);
    const editor = readFileSync(
      new URL("../app/host/events/[eventId]/host-event-editor.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(editor, /slug/);
  });
});

describe("host recovery", () => {
  beforeEach(() => {
    process.env.HOST_SESSION_SECRET = "p5-host-guest-test-secret";
    clearRecoveryIpLimits();
    clearSimulatedHostNotices();
  });

  it("answers the same way whether or not the email matches and never puts a management code in the notice", () => {
    assert.deepEqual(recoveryStartPayload(), { accepted: true });
    assert.deepEqual(Object.keys(recoveryStartPayload()), ["accepted"]);
    assert.equal(
      recoverySendDecision({ emailMatches: false, recentSends: 0, rotatedWithinCooldown: false }),
      "silent",
    );
    assert.equal(
      recoverySendDecision({ emailMatches: true, recentSends: 0, rotatedWithinCooldown: true }),
      "silent",
    );
    assert.equal(
      recoverySendDecision({ emailMatches: true, recentSends: 0, rotatedWithinCooldown: false }),
      "send",
    );

    const body = recoveryNoticeBody("123456");
    assert.match(body, /123456/);
    assert.doesNotMatch(body, /[A-Z0-9]{4}-[A-Z0-9]{4}/);
    assert.throws(() => deliverSimulatedHostNotice({ destinationHash: "hash", body: "CODE ABCD-EFGH" }));
    deliverSimulatedHostNotice({ destinationHash: "hash", body });
    const [notice] = readSimulatedHostNotices();
    assert.equal(notice?.simulated, true);
    assert.equal(notice?.delivered, false);
    assert.equal(notice?.body.includes("ABCD"), false);

    const start = readFileSync(new URL("../app/api/host/recovery/start/route.ts", import.meta.url), "utf8");
    assert.doesNotMatch(start, /accessCode|readSimulatedHostNotices/);
    const outbox = readFileSync(
      new URL("../app/api/host/recovery/local-outbox/route.ts", import.meta.url),
      "utf8",
    );
    assert.match(outbox, /localDatabaseUiAllowed/);
    assert.match(outbox, /status: 404/);
    assert.doesNotMatch(outbox, /accessCode/);
  });

  it("burns a challenge after five mismatches and keeps the public error uniform", () => {
    const now = "2026-01-01T00:00:00.000Z";
    const challenge = {
      id: "challenge",
      otpHash: "hash",
      expiresAt: "2026-01-01T00:10:00.000Z",
      attempts: 4,
      consumedAt: null,
    };
    const burned = planRecoveryConfirm({ challenge, otpMatches: false, now });
    assert.equal(burned.ok, false);
    if (!burned.ok) {
      assert.equal(burned.burn, true);
      assert.equal(burned.error, RECOVERY_MISMATCH);
    }
    const missing = planRecoveryConfirm({ challenge: null, otpMatches: true, now });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error, RECOVERY_MISMATCH);
    }
    const accepted = planRecoveryConfirm({
      challenge: { ...challenge, attempts: 0 },
      otpMatches: true,
      now,
    });
    assert.equal(accepted.ok, true);
  });

  it("hashes the one-time code and limits requests per address", async () => {
    const hash = await hashOneTimeCode("123456");
    assert.equal(hash.includes("123456"), false);
    assert.equal(await oneTimeCodeMatches("123456", hash), true);
    assert.equal(await oneTimeCodeMatches("000000", hash), false);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.equal(noteRecoveryIp("203.0.113.8", 1_700_000_000_000).ok, true);
    }
    assert.equal(noteRecoveryIp("203.0.113.8", 1_700_000_000_000).ok, false);
  });

  it("separates the identity session from the event session and revokes a stale version", () => {
    const event = createHostSessionToken("event-1", 3);
    const identity = createHostIdentityToken("identity-1");
    assert.equal(readHostSessionToken(identity), null);
    assert.equal(readHostIdentityToken(event), null);
    assert.equal(readHostSessionToken(event)?.sv, 3);
    assert.equal(readHostSessionToken(createHostSessionToken("event-1"))?.sv, undefined);
    assert.equal(hostSessionVersionMatches({ sv: 3 }, 3), true);
    assert.equal(hostSessionVersionMatches({}, 3), false);
    assert.equal(hostSessionVersionMatches({}, "legacy"), true);
    assert.equal(hostSessionVersionMatches({ sv: 0 }, "legacy"), false);
    assert.equal(hostSessionVersionMatches({ sv: 0 }, "missing"), false);
  });
});

describe("host list and guest order status", () => {
  it("returns only the list fields and masks the recovery email", () => {
    const summary = toHostEventSummary({
      id: "1",
      title: "חג",
      event_date: "2026-11-12",
      slug: "event-ab12",
    });
    assert.deepEqual(Object.keys(summary).sort(), ["date", "id", "slug", "title"]);
    assert.equal(summary.slug, "event-ab12");
    const masked = maskEmail("Dana@Example.com");
    assert.equal(masked, "d***@example.com");
    assert.equal(masked.includes("Dana"), false);
    const message = buildInvitationMessage({
      greeting: "היי {name}, נתראה ב{event}",
      guestName: "דנה",
      eventTitle: "יום הולדת",
      inviteUrl: "https://lolo.example/i/abc",
    });
    assert.match(message, /דנה/);
    assert.match(message, /יום הולדת/);
    assert.match(message, /https:\/\/lolo.example\/i\/abc/);
  });

  it("shows cancel and refund states without inventing a refund policy", () => {
    assert.equal(guestCanCancel({ paymentStatus: "pending" }), true);
    assert.equal(guestCanCancel({ paymentStatus: "paid" }), false);
    assert.equal(guestCanCancel({ paymentStatus: "cancelled" }), false);
    assert.equal(guestPaymentStatusLabel({ paymentStatus: "paid", paymentProvider: "demo" }), "שולם בהדגמה");
    assert.equal(guestPaymentStatusLabel({ paymentStatus: "cancelled" }), "ההזמנה בוטלה");
    assert.equal(guestCancelLine({ paymentStatus: "cancelled" }), "ההזמנה בוטלה. לא בוצע חיוב.");
    assert.equal(
      guestCanRequestRefund({
        paymentStatus: "paid",
        chargedAmount: 80,
        refundedAmount: 30,
        refundStatus: "partial",
      }),
      true,
    );
    assert.equal(
      guestRefundRemaining({ paymentStatus: "paid", chargedAmount: 80, refundedAmount: 30 }),
      50,
    );
    assert.equal(
      guestCanRequestRefund({ paymentStatus: "paid", chargedAmount: 80, refundedAmount: 80, refundStatus: "full" }),
      false,
    );
    assert.equal(guestRefundLine({ paymentStatus: "paid", refundStatus: "full" }), "ההחזר נרשם. לא הועבר כסף אמיתי.");
    assert.equal(guestRefundLine({ paymentStatus: "paid", refundStatus: "none" }), "");
    const view = readFileSync(new URL("../app/e/[slug]/thank-you/thank-you-view.tsx", import.meta.url), "utf8");
    assert.match(view, /\/api\/payments\/cancel|cancelGuestCheckout/);
    assert.match(view, /requestGuestRefund/);
    assert.match(view, /data-refund-error/);
    assert.match(view, /data-cancel-error/);
  });

  it("keeps recovery data out of the guest select and closes the new tables", () => {
    const guestLoad = readFileSync(new URL("../lib/events/load-guest-event.ts", import.meta.url), "utf8");
    const columns = guestLoad.slice(guestLoad.indexOf("EVENT_COLUMNS"), guestLoad.indexOf("GIFT_COLUMNS"));
    assert.doesNotMatch(columns, /invitation_greeting|recovery_email|host_identities/);
    const sql = readFileSync(new URL("../supabase/host-identity.sql", import.meta.url), "utf8");
    assert.match(sql, /create table if not exists public\.host_identities/);
    assert.match(sql, /create table if not exists public\.host_identity_events/);
    assert.match(sql, /create table if not exists public\.host_recovery_challenges/);
    assert.match(sql, /session_version integer not null default 0/);
    assert.match(sql, /invitation_greeting text not null default ''/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /using \(false\)/);
    assert.match(sql, /otp_hash text not null/);
    assert.doesNotMatch(sql, /insert into public\.events/i);
    assert.doesNotMatch(sql, /access_code text/i);
    assert.doesNotMatch(sql, /\botp text\b/i);
  });
});
