import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseGuestFeeSettings } from "../lib/admin/guest-fee-input";
import { calculateEventFunding } from "../lib/funding/calculate";
import {
  calculateGuestFee,
  GUEST_FEE_OFF,
  orderMoneyFromRow,
} from "../lib/payments/fee";
import { resolveProviderKind } from "../lib/payments/selection";
import {
  clearGuestOrderRef,
  loadGuestOrderRef,
  saveGuestOrderRef,
} from "../lib/orders/guest-ref";
import { decideStoredOrderWrite } from "../lib/orders/repeat";
import { thankYouAfterLoad } from "../lib/orders/thank-you-ref";
import { decideCancel, decideMarkFailed, decideMarkPaid } from "../lib/payments/state";
import { REAL_PROVIDER_ALLOWLIST } from "../lib/payments/allowlist";
import { commitCapturesTogether, createCaptureLedger } from "../lib/payments/capture-ledger";
import { performDemoRefund } from "../lib/payments/demo-refund";
import { buildDemoWebhookBody, parseDemoWebhook } from "../lib/payments/events";
import { createLiveProviderStub } from "../lib/payments/live-stub";
import {
  isMissingPaymentsSchema,
  PAYMENTS_LEDGER_NOT_ENABLED,
  REFUND_DEMO_NO_NETWORK,
  REFUND_POLICY_NOT_CONFIGURED,
  WEBHOOK_BAD_SIGNATURE,
} from "../lib/payments/messages";
import { assertDemoMoneyCapture } from "../lib/payments/separation";
import { verifyWebhookSignature, signWebhookBody } from "../lib/payments/webhook-signature";
import { screenWebhook } from "../lib/payments/webhook-screen";

const pending = {
  paymentStatus: "pending" as const,
  paymentProvider: null,
  paymentReference: null,
  paidAt: null,
};

describe("demo checkout funding and payments", () => {
  it("counts only paid contributions and allows progress above 100 percent", () => {
    const funding = calculateEventFunding({
      gifts: [
        { id: "gift-a", targetAmount: 1000 },
        { id: "gift-b", targetAmount: 100 },
      ],
      orders: [
        { id: "order-1", paymentStatus: "paid" },
        { id: "order-2", paymentStatus: "paid" },
        { id: "order-3", paymentStatus: "pending" },
        { id: "order-4", paymentStatus: "failed" },
      ],
      items: [
        { orderId: "order-1", giftId: "gift-a", amount: 800 },
        { orderId: "order-2", giftId: "gift-a", amount: 320 },
        { orderId: "order-1", giftId: "gift-a", amount: 0 },
        { orderId: "order-3", giftId: "gift-a", amount: 500 },
        { orderId: "order-4", giftId: "gift-a", amount: 100 },
        { orderId: "order-2", giftId: "gift-b", amount: 40 },
      ],
    });

    const giftA = funding.gifts.find((gift) => gift.giftId === "gift-a");
    const giftB = funding.gifts.find((gift) => gift.giftId === "gift-b");
    assert.ok(giftA);
    assert.ok(giftB);
    assert.equal(giftA.raisedAmount, 1120);
    assert.equal(giftA.pendingAmount, 500);
    assert.equal(giftA.contributorCount, 2);
    assert.equal(giftA.percentOfTarget, 112);
    assert.equal(giftB.raisedAmount, 40);
    assert.equal(giftB.contributorCount, 1);
    assert.equal(giftB.percentOfTarget, 40);
    assert.equal(funding.paidAmount, 1160);
    assert.equal(funding.pendingAmount, 500);
    assert.equal(funding.paidOrderCount, 2);
    assert.equal(funding.pendingOrderCount, 1);
  });

  it("counts two lines on one paid order as a single contributor", () => {
    const funding = calculateEventFunding({
      gifts: [{ id: "gift-a", targetAmount: null }],
      orders: [{ id: "order-1", paymentStatus: "paid" }],
      items: [
        { orderId: "order-1", giftId: "gift-a", amount: 50 },
        { orderId: "order-1", giftId: "gift-a", amount: 50 },
      ],
    });

    assert.equal(funding.gifts[0]?.raisedAmount, 100);
    assert.equal(funding.gifts[0]?.contributorCount, 1);
    assert.equal(funding.gifts[0]?.percentOfTarget, null);
  });

  it("keeps the guest fee off the funded amount", () => {
    const money = calculateGuestFee(1120, {
      enabled: true,
      percent: 10,
      fixedAmount: 0,
    });
    assert.equal(money.feeAmount, 112);
    assert.equal(money.chargedAmount, 1232);

    const funding = calculateEventFunding({
      gifts: [{ id: "gift-a", targetAmount: 1000 }],
      orders: [{ id: "order-1", paymentStatus: "paid" }],
      items: [{ orderId: "order-1", giftId: "gift-a", amount: money.contributionAmount }],
    });
    assert.equal(funding.paidAmount, 1120);
    assert.equal(funding.gifts[0]?.percentOfTarget, 112);
  });

  it("charges no fee unless the founder turns it on", () => {
    const disabled = calculateGuestFee(200, {
      enabled: false,
      percent: 10,
      fixedAmount: 5,
    });
    assert.deepEqual(disabled, {
      contributionAmount: 200,
      feeAmount: 0,
      chargedAmount: 200,
    });

    assert.deepEqual(calculateGuestFee(200, GUEST_FEE_OFF), {
      contributionAmount: 200,
      feeAmount: 0,
      chargedAmount: 200,
    });

    const enabled = calculateGuestFee(100, {
      enabled: true,
      percent: 10,
      fixedAmount: 5,
    });
    assert.equal(enabled.feeAmount, 15);
    assert.equal(enabled.chargedAmount, 115);

    const percentOnly = calculateGuestFee(200, {
      enabled: true,
      percent: 2.5,
      fixedAmount: 0,
    });
    assert.equal(percentOnly.feeAmount, 5);
    assert.equal(percentOnly.chargedAmount, 205);
  });

  it("treats a missing fee on an existing order as zero", () => {
    assert.deepEqual(
      orderMoneyFromRow({
        total_amount: "80",
        fee_amount: null,
        charged_amount: null,
      }),
      {
        contributionAmount: 80,
        feeAmount: 0,
        chargedAmount: 80,
      },
    );
  });

  it("marks an order paid once and keeps the first reference", () => {
    const firstAttempt = {
      provider: "demo",
      paymentReference: "demo-first",
      paidAt: "2026-10-07T10:00:00.000Z",
    };
    const first = decideMarkPaid(pending, firstAttempt);
    assert.equal(first.action, "mark_paid");
    if (first.action !== "mark_paid") {
      return;
    }

    const second = decideMarkPaid(first.snapshot, {
      provider: "demo",
      paymentReference: "demo-second",
      paidAt: "2026-10-07T11:00:00.000Z",
    });
    assert.equal(second.action, "already_paid");
    assert.equal(second.snapshot.paymentReference, "demo-first");
    assert.equal(second.snapshot.paidAt, "2026-10-07T10:00:00.000Z");
    assert.equal(second.snapshot.paymentProvider, "demo");

    const failedAfterPaid = decideMarkFailed(second.snapshot, "demo");
    assert.equal(failedAfterPaid.action, "already_paid");
    assert.equal(failedAfterPaid.snapshot.paymentStatus, "paid");
    assert.equal(failedAfterPaid.snapshot.paymentReference, "demo-first");
  });

  it("lets a simulated failure be paid later without undoing a paid order", () => {
    const failed = decideMarkFailed(pending, "demo");
    assert.equal(failed.action, "mark_failed");
    if (failed.action !== "mark_failed") {
      return;
    }
    assert.equal(failed.snapshot.paymentProvider, "demo");
    assert.equal(failed.snapshot.paidAt, null);

    const repeated = decideMarkFailed(failed.snapshot, "demo");
    assert.equal(repeated.action, "already_failed");

    const paid = decideMarkPaid(failed.snapshot, {
      provider: "demo",
      paymentReference: "demo-retry",
      paidAt: "2026-10-07T12:00:00.000Z",
    });
    assert.equal(paid.action, "mark_paid");
    assert.equal(paid.snapshot.paymentReference, "demo-retry");

    assert.equal(
      decideMarkPaid(
        { ...pending, paymentStatus: "cancelled" },
        {
          provider: "demo",
          paymentReference: "demo-nope",
          paidAt: "2026-10-07T12:00:00.000Z",
        },
      ).action,
      "reject",
    );
  });

  it("selects demo checkout when no live provider is configured", () => {
    assert.equal(resolveProviderKind(undefined), "demo");
    assert.equal(resolveProviderKind(""), "demo");
    assert.equal(resolveProviderKind(" demo "), "demo");
    assert.equal(resolveProviderKind("none"), "none");
    assert.equal(resolveProviderKind("cardcom"), "unconfigured-live");
  });

  it("rejects an out-of-range guest fee and accepts the off default", () => {
    assert.throws(
      () =>
        parseGuestFeeSettings({
          guestFeeEnabled: true,
          guestFeePercent: 101,
          guestFeeFixed: 0,
        }),
      /אחוז העמלה/,
    );

    assert.deepEqual(
      parseGuestFeeSettings({
        guestFeeEnabled: false,
        guestFeePercent: 0,
        guestFeeFixed: 0,
      }),
      GUEST_FEE_OFF,
    );
  });
});

describe("repeat guest purchase", () => {
  it("opens a new order after paid or cancelled and keeps pending and failed editable", () => {
    const sameGuest = { accessTokenMatches: true, eventMatches: true };
    assert.equal(
      decideStoredOrderWrite({ ...sameGuest, paymentStatus: "paid" }),
      "replace",
    );
    assert.equal(
      decideStoredOrderWrite({ ...sameGuest, paymentStatus: "cancelled" }),
      "replace",
    );
    assert.equal(
      decideStoredOrderWrite({ ...sameGuest, paymentStatus: "pending" }),
      "update",
    );
    assert.equal(
      decideStoredOrderWrite({ ...sameGuest, paymentStatus: "failed" }),
      "update",
    );
    assert.equal(
      decideStoredOrderWrite({
        accessTokenMatches: false,
        eventMatches: true,
        paymentStatus: "paid",
      }),
      "reject-auth",
    );
    assert.equal(
      decideStoredOrderWrite({
        accessTokenMatches: true,
        eventMatches: false,
        paymentStatus: "cancelled",
      }),
      "reject-auth",
    );
    assert.equal(
      decideStoredOrderWrite({ ...sameGuest, paymentStatus: "unknown" }),
      "reject-closed",
    );
  });

  it("clears only that event's paid order ref", () => {
    const store = new Map<string, string>();
    const previousWindow = globalThis.window;
    Object.assign(globalThis, {
      window: {
        localStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => {
            store.set(key, value);
          },
          removeItem: (key: string) => {
            store.delete(key);
          },
        },
      },
    });

    try {
      saveGuestOrderRef("event-a", { id: "order-1", accessToken: "token-1" });
      saveGuestOrderRef("event-b", { id: "order-2", accessToken: "token-2" });
      store.set("lolo-guest-details:event-a", "{\"name\":\"נועה\"}");

      clearGuestOrderRef("event-a");

      assert.equal(loadGuestOrderRef("event-a"), null);
      assert.deepEqual(loadGuestOrderRef("event-b"), {
        id: "order-2",
        accessToken: "token-2",
      });
      assert.equal(store.get("lolo-guest-details:event-a"), "{\"name\":\"נועה\"}");
      assert.equal(store.has("lolo-guest-order:event-a"), false);
    } finally {
      Object.assign(globalThis, { window: previousWindow });
    }
  });

  it("clears the order ref only after the thank-you screen verified a paid order", () => {
    const store = new Map<string, string>();
    const previousWindow = globalThis.window;
    Object.assign(globalThis, {
      window: {
        localStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => {
            store.set(key, value);
          },
          removeItem: (key: string) => {
            store.delete(key);
          },
        },
      },
    });

    try {
      saveGuestOrderRef("event-a", { id: "order-3", accessToken: "token-3" });

      for (const paymentStatus of ["pending", "failed", "cancelled"]) {
        const waiting = thankYouAfterLoad(
          { ok: true, paymentStatus },
          false,
        );
        assert.equal(waiting.clearRef, false);
        assert.equal(waiting.replaceDisplay, true);
        assert.equal(waiting.confirmedPaid, false);
      }

      const failedLoad = thankYouAfterLoad({ ok: false }, false);
      assert.equal(failedLoad.clearRef, false);
      assert.equal(failedLoad.replaceDisplay, true);

      const paid = thankYouAfterLoad({ ok: true, paymentStatus: "paid" }, false);
      assert.equal(paid.clearRef, true);
      assert.equal(paid.confirmedPaid, true);
      if (paid.clearRef) {
        clearGuestOrderRef("event-a");
      }

      assert.equal(loadGuestOrderRef("event-a"), null);
      const shownAgain = thankYouAfterLoad({ ok: false }, paid.confirmedPaid);
      assert.equal(shownAgain.clearRef, false);
      assert.equal(shownAgain.replaceDisplay, false);
      assert.equal(shownAgain.confirmedPaid, true);
    } finally {
      Object.assign(globalThis, { window: previousWindow });
    }
  });
});

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

const configuredPolicy = {
  windowDays: 2,
  approver: "guest" as const,
  allowPartial: true,
  blocksIssuedVoucher: true,
};

describe("payment attempts, webhooks, and demo refunds", () => {
  it("keeps the real-provider allow-list empty", () => {
    assert.deepEqual([...REAL_PROVIDER_ALLOWLIST], []);
    assert.equal(resolveProviderKind(undefined), "demo");
    assert.equal(resolveProviderKind("cardcom"), "unconfigured-live");
  });

  it("replays a confirm onto the first reference and paid_at", () => {
    const ledger = createCaptureLedger();
    const first = ledger.commit({
      orderId: ORDER_ID,
      idempotencyKey: `confirm-success:${ORDER_ID}`,
      provider: "demo",
      providerReference: "demo-first",
      providerEventId: null,
      paidAt: "2026-10-07T10:00:00.000Z",
    });
    const replay = ledger.commit({
      orderId: ORDER_ID,
      idempotencyKey: `confirm-success:${ORDER_ID}`,
      provider: "demo",
      providerReference: "demo-second",
      providerEventId: null,
      paidAt: "2026-10-07T11:00:00.000Z",
    });
    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(replay.paidAt, "2026-10-07T10:00:00.000Z");
    assert.equal(replay.providerReference, "demo-first");
  });

  it("leaves one paid_at when two captures commit together", async () => {
    const ledger = createCaptureLedger();
    const [first, second] = await commitCapturesTogether(ledger, [
      {
        orderId: ORDER_ID,
        idempotencyKey: "confirm-a",
        provider: "demo",
        providerReference: "demo-a",
        providerEventId: "evt_demo_a1",
        paidAt: "2026-10-07T10:00:00.000Z",
      },
      {
        orderId: ORDER_ID,
        idempotencyKey: "confirm-b",
        provider: "demo",
        providerReference: "demo-b",
        providerEventId: "evt_demo_b2",
        paidAt: "2026-10-07T10:00:01.000Z",
      },
    ]);
    assert.equal(first.paidAt, second.paidAt);
    assert.equal(first.providerReference, second.providerReference);
    assert.equal([first.replayed, second.replayed].filter((replayed) => !replayed).length, 1);
  });

  it("rejects a bad webhook signature before parsing the body", () => {
    const event = {
      eventId: "evt_demo_01",
      type: "payment.succeeded" as const,
      provider: "demo" as const,
      orderId: ORDER_ID,
      amount: 115,
    };
    const rawBody = buildDemoWebhookBody(event);
    const secret = "test-webhook-secret";
    const signature = `sha256=${signWebhookBody(rawBody, secret)}`;
    assert.equal(verifyWebhookSignature({ rawBody, signature, secret }).ok, true);
    assert.deepEqual(parseDemoWebhook(rawBody), event);

    let parsed = 0;
    const rejected = screenWebhook({
      rawBody: "not-json",
      signature: "sha256=deadbeef",
      secret,
      verify: verifyWebhookSignature,
      parse: () => {
        parsed += 1;
        return parseDemoWebhook(rawBody);
      },
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.message, WEBHOOK_BAD_SIGNATURE);
    }
    assert.equal(parsed, 0);
    assert.equal(verifyWebhookSignature({ rawBody, signature: signature, secret: "" }).ok, false);

    const sameEvent = createCaptureLedger();
    const delivered = sameEvent.commit({
      orderId: ORDER_ID,
      idempotencyKey: event.eventId,
      provider: "demo",
      providerReference: "demo-hook",
      providerEventId: event.eventId,
      paidAt: "2026-10-07T12:00:00.000Z",
    });
    const again = sameEvent.commit({
      orderId: ORDER_ID,
      idempotencyKey: "other-key",
      provider: "demo",
      providerReference: "demo-other",
      providerEventId: event.eventId,
      paidAt: "2026-10-07T12:00:05.000Z",
    });
    assert.equal(again.replayed, true);
    assert.equal(again.paidAt, delivered.paidAt);
  });

  it("records a demo refund without calling a transport", () => {
    let references = 0;
    let outboundCalls = 0;
    const outbound = () => {
      outboundCalls += 1;
      return Promise.resolve();
    };
    assert.throws(
      () =>
        performDemoRefund({
          orderId: ORDER_ID,
          actor: "guest",
          amount: 50,
          idempotencyKey: "refund-key-1",
          reason: "",
          now: "2026-10-08T10:00:00.000Z",
          policy: configuredPolicy,
          paymentStatus: "paid",
          paymentProvider: "demo",
          paymentReference: "demo-paid",
          paidAt: "2026-10-07T10:00:00.000Z",
          chargedAmount: 100,
          alreadyRefunded: 0,
          issuedVoucher: false,
          existing: null,
          createReference: () => "demo-refund-fixed",
          outbound,
        }),
      new RegExp(REFUND_DEMO_NO_NETWORK),
    );
    assert.equal(outboundCalls, 0);

    const recorded = performDemoRefund({
      orderId: ORDER_ID,
      actor: "guest",
      amount: 40,
      idempotencyKey: "refund-key-1",
      reason: "בדיקה",
      now: "2026-10-08T10:00:00.000Z",
      policy: configuredPolicy,
      paymentStatus: "paid",
      paymentProvider: "demo",
      paymentReference: "demo-paid",
      paidAt: "2026-10-07T10:00:00.000Z",
      chargedAmount: 100,
      alreadyRefunded: 0,
      issuedVoucher: false,
      existing: null,
      createReference: () => {
        references += 1;
        return "demo-refund-fixed";
      },
    });
    assert.equal(recorded.externalUrl, null);
    assert.equal(recorded.simulated, true);
    assert.equal(recorded.provider, "demo");
    assert.equal(recorded.amount, 40);
    assert.equal(references, 1);

    const replay = performDemoRefund({
      orderId: ORDER_ID,
      actor: "guest",
      amount: 40,
      idempotencyKey: "refund-key-1",
      reason: "בדיקה",
      now: "2026-10-08T10:00:00.000Z",
      policy: configuredPolicy,
      paymentStatus: "paid",
      paymentProvider: "demo",
      paymentReference: "demo-paid",
      paidAt: "2026-10-07T10:00:00.000Z",
      chargedAmount: 100,
      alreadyRefunded: 40,
      issuedVoucher: false,
      existing: recorded,
      createReference: () => {
        references += 1;
        return "demo-refund-other";
      },
    });
    assert.equal(replay.replayed, true);
    assert.equal(replay.providerReference, "demo-refund-fixed");
    assert.equal(references, 1);

    assert.throws(
      () =>
        performDemoRefund({
          orderId: ORDER_ID,
          actor: "guest",
          amount: 40,
          idempotencyKey: "refund-key-2",
          reason: "",
          now: "2026-10-08T10:00:00.000Z",
          policy: {
            windowDays: null,
            approver: null,
            allowPartial: null,
            blocksIssuedVoucher: null,
          },
          paymentStatus: "paid",
          paymentProvider: "demo",
          paymentReference: "demo-paid",
          paidAt: "2026-10-07T10:00:00.000Z",
          chargedAmount: 100,
          alreadyRefunded: 0,
          issuedVoucher: false,
          existing: null,
          createReference: () => "demo-refund-nope",
        }),
      new RegExp(REFUND_POLICY_NOT_CONFIGURED),
    );
  });

  it("does not call the network from a live provider stub", async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => {
      calls += 1;
      throw new Error("network");
    }) as typeof fetch;
    try {
      const stub = createLiveProviderStub("cardcom");
      await assert.rejects(
        () =>
          stub.refund({
            orderId: ORDER_ID,
            accessToken: null,
            actor: "admin",
            amount: 10,
            idempotencyKey: "refund-live-1",
            reason: "",
          }),
        /עדיין לא הופעל/,
      );
      await assert.rejects(() => stub.confirm({
        orderId: ORDER_ID,
        accessToken: ORDER_ID,
        outcome: "success",
        idempotencyKey: "confirm-success:unused",
      }), /עדיין לא הופעל/);
      assert.equal(calls, 0);
      assert.equal(stub.verifyWebhook({ rawBody: "{}", signature: "sha256=00", secret: "x" }).ok, false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("refuses to mark demo money as a live capture", () => {
    assert.doesNotThrow(() =>
      assertDemoMoneyCapture({ provider: "demo", paymentReference: "demo-ok" }),
    );
    assert.throws(
      () => assertDemoMoneyCapture({ provider: "cardcom", paymentReference: "pay-1" }),
      /עדיין לא הופעל/,
    );
    assert.throws(
      () => assertDemoMoneyCapture({ provider: "demo", paymentReference: "pay-1" }),
      /עדיין לא הופעל/,
    );
  });

  it("cancels only an unpaid order", () => {
    assert.equal(decideCancel(pending).action, "cancel");
    assert.equal(
      decideCancel({ ...pending, paymentStatus: "failed" }).action,
      "cancel",
    );
    assert.equal(
      decideCancel({ ...pending, paymentStatus: "cancelled" }).action,
      "already_cancelled",
    );
    assert.equal(
      decideCancel({
        paymentStatus: "paid",
        paymentProvider: "demo",
        paymentReference: "demo-paid",
        paidAt: "2026-10-07T10:00:00.000Z",
      }).action,
      "reject",
    );
  });

  it("fails closed when the payment tables are missing and does not hard-code a refund window", () => {
    assert.equal(
      isMissingPaymentsSchema({
        code: "PGRST205",
        message: "Could not find the table public.payment_attempts in the schema cache",
      }),
      true,
    );
    assert.equal(PAYMENTS_LEDGER_NOT_ENABLED.includes("עדיין לא הופעל"), true);

    for (const relative of [
      "../lib/payments/refund-policy.ts",
      "../lib/payments/demo-refund.ts",
      "../app/api/payments/refund/route.ts",
      "../lib/payments/demo-refund.ts",
    ]) {
      const source = readFileSync(new URL(relative, import.meta.url), "utf8");
      assert.equal(/windowDays\s*[:=]\s*\d+/.test(source), false);
      assert.equal(source.includes("fetch("), false);
      assert.equal(/https?:\/\//.test(source), false);
    }

    const sql = readFileSync(new URL("../supabase/payments-attempts.sql", import.meta.url), "utf8");
    assert.equal(sql.includes("payment_attempts"), true);
    assert.equal(sql.includes("payment_refunds"), true);
    assert.equal(sql.includes("unique (order_id, idempotency_key)"), true);
    assert.equal(sql.includes("payment_attempts_provider_reference_uidx"), true);
    assert.equal(sql.includes("payment_refunds_provider_reference_uidx"), true);
    assert.equal(sql.includes("enable row level security"), true);
    assert.equal(/create policy/i.test(sql), false);
    assert.equal(sql.includes("check (simulated)"), true);
    assert.equal(sql.includes("refund_window_days"), true);
  });
});
