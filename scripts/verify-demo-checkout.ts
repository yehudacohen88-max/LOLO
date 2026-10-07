import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGuestFeeSettings } from "../lib/admin/guest-fee-input";
import { calculateEventFunding } from "../lib/funding/calculate";
import {
  calculateGuestFee,
  GUEST_FEE_OFF,
  orderMoneyFromRow,
} from "../lib/payments/fee";
import { resolveProviderKind } from "../lib/payments/selection";
import { decideMarkFailed, decideMarkPaid } from "../lib/payments/state";

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
