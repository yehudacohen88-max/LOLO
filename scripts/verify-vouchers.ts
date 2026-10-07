import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { calculateEventFunding } from "../lib/funding/calculate";
import { calculateGuestFee } from "../lib/payments/fee";
import { parseVoucherLookup } from "../lib/vouchers/code";
import {
  planVoucherIssue,
  planVoucherRedeem,
  resetLedgerIds,
  VoucherLedger,
} from "../lib/vouchers/ledger";
import { voucherErrorMessage } from "../lib/vouchers/messages";
import { resolveVoucherTerms } from "../lib/vouchers/terms";

const FUTURE = Date.now() + 7 * 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-07T12:00:00.000Z");

describe("voucher amount follows paid contributions", () => {
  beforeEach(() => {
    resetLedgerIds();
  });

  it("issues the paid amount, not the target, and ignores the guest fee", () => {
    const fee = calculateGuestFee(850, { enabled: true, percent: 5, fixedAmount: 2 });
    const funding = calculateEventFunding({
      gifts: [{ id: "gift-bike", targetAmount: 1200 }],
      orders: [{ id: "order-1", paymentStatus: "paid" }],
      items: [{ orderId: "order-1", giftId: "gift-bike", amount: 850 }],
    });

    assert.equal(fee.chargedAmount, 894.5);
    assert.equal(funding.gifts[0]?.raisedAmount, 850);
    assert.equal(funding.gifts[0]?.percentOfTarget, 70.83);

    const plan = planVoucherIssue(funding.gifts[0]?.raisedAmount ?? 0, []);
    assert.deepEqual(plan, { ok: true, amount: 850 });
    assert.notEqual(plan.ok && plan.amount, 1200);
    assert.notEqual(plan.ok && plan.amount, fee.chargedAmount);
  });

  it("issues an additional voucher only for money paid after the first voucher", async () => {
    const ledger = new VoucherLedger();
    ledger.setPaid(850);
    const first = await ledger.issue({
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      allowPartial: false,
      expiresAt: FUTURE,
    });
    assert.equal(first.ok, true);
    if (!first.ok) {
      return;
    }
    assert.equal(first.voucher.amount, 850);

    ledger.setPaid(1000);
    const second = await ledger.issue({
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
      allowPartial: true,
      expiresAt: FUTURE,
    });
    assert.equal(second.ok, true);
    if (!second.ok) {
      return;
    }
    assert.equal(second.voucher.amount, 150);
    assert.equal(ledger.vouchers.reduce((sum, voucher) => sum + voucher.amount, 0), 1000);

    const third = await ledger.issue({
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      allowPartial: true,
      expiresAt: FUTURE,
    });
    assert.deepEqual(third, { ok: false, reason: "none" });
  });

  it("does not issue the same paid money twice, including a repeated request", async () => {
    const ledger = new VoucherLedger();
    ledger.setPaid(850);
    const input = {
      allowPartial: false,
      expiresAt: FUTURE,
      expectedAmount: 850,
    };
    const [first, second] = await Promise.all([
      ledger.issue({ ...input, idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
      ledger.issue({ ...input, idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    ]);
    const issued = [first, second].filter((result) => result.ok);
    assert.equal(issued.length, 1);
    assert.equal(ledger.vouchers.length, 1);
    assert.equal(ledger.vouchers[0]?.amount, 850);

    const retry = await ledger.issue({
      ...input,
      idempotencyKey: ledger.vouchers[0]?.idempotencyKey ?? "",
    });
    assert.equal(retry.ok, true);
    if (retry.ok) {
      assert.equal(retry.idempotent, true);
      assert.equal(retry.voucher.id, ledger.vouchers[0]?.id);
    }
    assert.equal(ledger.vouchers.length, 1);
  });

  it("rejects an issue when the confirmed amount is no longer the open balance", () => {
    const changed = planVoucherIssue(850, [], 800);
    assert.deepEqual(changed, { ok: false, reason: "changed" });
  });
});

describe("redemption follows the snapshotted store rules", () => {
  beforeEach(() => {
    resetLedgerIds();
  });

  it("blocks a partial redemption when the store does not allow it, and allows it when it does", async () => {
    const blocked = new VoucherLedger();
    blocked.setPaid(850);
    const fullOnly = await blocked.issue({
      idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      allowPartial: false,
      expiresAt: FUTURE,
    });
    assert.equal(fullOnly.ok, true);
    if (!fullOnly.ok) {
      return;
    }
    const partialAttempt = await blocked.redeem(fullOnly.voucher.id, 100, NOW);
    assert.deepEqual(partialAttempt, { ok: false, reason: "partial" });
    const full = await blocked.redeem(fullOnly.voucher.id, 850, NOW);
    assert.equal(full.ok, true);
    if (full.ok) {
      assert.equal(full.voucher.status, "REDEEMED");
      assert.equal(full.voucher.remaining, 0);
    }

    const allowed = new VoucherLedger();
    allowed.setPaid(850);
    const flexible = await allowed.issue({
      idempotencyKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      allowPartial: true,
      expiresAt: FUTURE,
    });
    assert.equal(flexible.ok, true);
    if (!flexible.ok) {
      return;
    }
    const part = await allowed.redeem(flexible.voucher.id, 200, NOW);
    assert.equal(part.ok, true);
    if (part.ok) {
      assert.equal(part.voucher.remaining, 650);
      assert.equal(part.voucher.status, "PARTIALLY_REDEEMED");
    }
    const rest = await allowed.redeem(flexible.voucher.id, null, NOW);
    assert.equal(rest.ok, true);
    if (rest.ok) {
      assert.equal(rest.voucher.status, "REDEEMED");
    }
  });

  it("refuses expired vouchers and vouchers that are already used", async () => {
    const ledger = new VoucherLedger();
    ledger.setPaid(850);
    const expired = await ledger.issue({
      idempotencyKey: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      allowPartial: true,
      expiresAt: NOW - 1000,
    });
    assert.equal(expired.ok, true);
    if (!expired.ok) {
      return;
    }
    assert.deepEqual(await ledger.redeem(expired.voucher.id, null, NOW), {
      ok: false,
      reason: "expired",
    });

    const used = new VoucherLedger();
    used.setPaid(850);
    const voucher = await used.issue({
      idempotencyKey: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      allowPartial: false,
      expiresAt: FUTURE,
    });
    assert.equal(voucher.ok, true);
    if (!voucher.ok) {
      return;
    }
    assert.equal((await used.redeem(voucher.voucher.id, null, NOW)).ok, true);
    const again = await used.redeem(voucher.voucher.id, null, NOW);
    assert.deepEqual(again, { ok: false, reason: "closed" });
    assert.deepEqual(planVoucherRedeem(
      { status: "CANCELLED", expiresAt: FUTURE, remaining: 0, allowPartial: true },
      10,
      NOW,
    ), { ok: false, reason: "closed" });
  });
});

describe("store terms and voucher codes", () => {
  it("uses visible fallbacks when the store has not configured voucher terms", () => {
    const terms = resolveVoucherTerms({
      voucherValidityDays: null,
      allowPartialRedemption: null,
      allowCustomerTopup: null,
      voucherRedemptionMethod: null,
    });
    assert.equal(terms.validityDays, 365);
    assert.equal(terms.validityIsDefault, true);
    assert.equal(terms.allowPartialRedemption, false);
    assert.equal(terms.partialIsDefault, true);
    assert.equal(terms.allowCustomerTopup, false);
    assert.equal(terms.topupIsDefault, true);
    assert.equal(terms.redemptionMethod, "הצגת השובר בחנות");
    assert.equal(terms.methodIsDefault, true);

    const configured = resolveVoucherTerms({
      voucherValidityDays: 90,
      allowPartialRedemption: true,
      allowCustomerTopup: true,
      voucherRedemptionMethod: "בחנות",
    });
    assert.equal(configured.validityIsDefault, false);
    assert.equal(configured.allowPartialRedemption, true);
    assert.equal(configured.methodIsDefault, false);
  });

  it("reads a scanned payload separately from a typed code", () => {
    const scanned = parseVoucherLookup("LOLO1.ABCD2345EFGH6789.secret-value");
    assert.equal(scanned.code, "ABCD2345EFGH6789");
    assert.equal(scanned.qrSecret, "secret-value");
    const typed = parseVoucherLookup("ABCD-2345-EFGH-6789");
    assert.equal(typed.code, "ABCD-2345-EFGH-6789");
    assert.equal(typed.qrSecret, null);
  });

  it("keeps failure text in Hebrew without the internal code", () => {
    const message = voucherErrorMessage("voucher_expired");
    assert.equal(message, "פג תוקף השובר.");
    assert.equal(message.includes("voucher_"), false);
    assert.equal(voucherErrorMessage("voucher_partial_disabled").includes("partial"), false);
  });
});
