import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { calculateEventFunding } from "../lib/funding/calculate";
import { REFUND_VOUCHER_BLOCKED } from "../lib/payments/messages";
import { decideRefund } from "../lib/payments/refund-policy";
import { calculateGuestFee } from "../lib/payments/fee";
import { buildVoucherBalance } from "../lib/vouchers/balance";
import { parseVoucherLookup } from "../lib/vouchers/code";
import {
  planVoucherIssue,
  planVoucherRedeem,
  resetLedgerIds,
  VoucherLedger,
} from "../lib/vouchers/ledger";
import {
  VOUCHER_TERMS_NOT_CONFIGURED,
  voucherErrorMessage,
} from "../lib/vouchers/messages";
import { planVoucherRefundRelease, refundCoversRemainder } from "../lib/vouchers/refund-release";
import {
  resolveVoucherTerms,
  snapshotIssuedTerms,
  UNSET_PLATFORM_VOUCHER_DEFAULTS,
  type PlatformVoucherDefaults,
  type StoreVoucherSettings,
} from "../lib/vouchers/terms";

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

const emptyStore: StoreVoucherSettings = {
  voucherValidityDays: null,
  allowPartialRedemption: null,
  allowCustomerTopup: null,
  voucherRedemptionMethod: null,
};

const platformDefaults: PlatformVoucherDefaults = {
  validityDays: 180,
  allowPartialRedemption: false,
  allowCustomerTopup: false,
  redemptionMethod: "הצגת השובר בחנות",
};

describe("voucher term defaults come from settings", () => {
  it("refuses to issue when neither the store nor the platform has a value", () => {
    const missing = resolveVoucherTerms(emptyStore, UNSET_PLATFORM_VOUCHER_DEFAULTS);
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.deepEqual(missing.missing, [
        "validityDays",
        "allowPartialRedemption",
        "allowCustomerTopup",
        "redemptionMethod",
      ]);
    }
    assert.equal(JSON.stringify(missing).includes("365"), false);
    assert.equal(VOUCHER_TERMS_NOT_CONFIGURED.includes("365"), false);
    assert.match(VOUCHER_TERMS_NOT_CONFIGURED, /לא הוגדרו/);
  });

  it("uses a platform value only for the fields the store left empty", () => {
    const fromPlatform = resolveVoucherTerms(emptyStore, platformDefaults);
    assert.equal(fromPlatform.ok, true);
    if (!fromPlatform.ok) {
      return;
    }
    assert.equal(fromPlatform.terms.validityDays, 180);
    assert.equal(fromPlatform.terms.validityIsDefault, true);
    assert.equal(fromPlatform.terms.allowPartialRedemption, false);
    assert.equal(fromPlatform.terms.partialIsDefault, true);

    const storeWins = resolveVoucherTerms(
      {
        voucherValidityDays: 90,
        allowPartialRedemption: true,
        allowCustomerTopup: true,
        voucherRedemptionMethod: "בחנות",
      },
      platformDefaults,
    );
    assert.equal(storeWins.ok, true);
    if (!storeWins.ok) {
      return;
    }
    assert.equal(storeWins.terms.validityDays, 90);
    assert.equal(storeWins.terms.validityIsDefault, false);
    assert.equal(storeWins.terms.allowPartialRedemption, true);
    assert.equal(storeWins.terms.partialIsDefault, false);
    assert.equal(storeWins.terms.methodIsDefault, false);
  });

  it("does not rewrite an issued voucher when the default changes", () => {
    const resolved = resolveVoucherTerms(emptyStore, platformDefaults);
    assert.equal(resolved.ok, true);
    if (!resolved.ok) {
      return;
    }
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const snapshot = snapshotIssuedTerms(resolved.terms, issuedAt);
    const changed = resolveVoucherTerms(emptyStore, { ...platformDefaults, validityDays: 30 });
    assert.equal(changed.ok, true);
    if (!changed.ok) {
      return;
    }
    assert.equal(snapshot.validityDays, 180);
    assert.equal(changed.terms.validityDays, 30);
    assert.equal(snapshot.expiresAt, "2026-06-30T00:00:00.000Z");
    assert.notEqual(snapshot.expiresAt, snapshotIssuedTerms(changed.terms, issuedAt).expiresAt);

    const balance = buildVoucherBalance({
      voucherId: "issued-1",
      amount: 100,
      remainingAmount: 100,
      status: "ISSUED",
      expiresAt: snapshot.expiresAt,
      now: Date.parse("2026-07-01T00:00:00.000Z"),
      redemptions: [],
    });
    assert.equal(balance.status, "EXPIRED");
    assert.equal(balance.expiresAt, snapshot.expiresAt);
    assert.equal(balance.remainingAmount, 100);
  });

  it("keeps the sql file to platform_settings columns", () => {
    const sql = readFileSync(
      new URL("../supabase/voucher-term-defaults.sql", import.meta.url),
      "utf8",
    );
    const executable = sql.replace(/--.*$/gm, "");
    assert.match(sql, /voucher_default_validity_days/);
    assert.match(sql, /voucher_default_allow_partial/);
    assert.match(sql, /voucher_default_allow_topup/);
    assert.match(sql, /voucher_default_redemption_method/);
    assert.equal(
      /issue_gift_voucher|redeem_voucher|cancel_voucher|create or replace/i.test(executable),
      false,
    );
    assert.equal(/default\s+365/i.test(executable), false);
    assert.equal(/update\s+public\.platform_settings/i.test(executable), false);
  });
});

describe("partial redemption follows the store flag", () => {
  it("uses the store partial flag instead of the platform default", async () => {
    const resolved = resolveVoucherTerms(
      { ...emptyStore, allowPartialRedemption: true, voucherValidityDays: 30, allowCustomerTopup: false, voucherRedemptionMethod: "בחנות" },
      { ...platformDefaults, allowPartialRedemption: false },
    );
    assert.equal(resolved.ok, true);
    if (!resolved.ok) {
      return;
    }
    assert.equal(resolved.terms.allowPartialRedemption, true);
    assert.equal(resolved.terms.partialIsDefault, false);

    const ledger = new VoucherLedger();
    ledger.setPaid(850);
    const issued = await ledger.issue({
      idempotencyKey: "12121212-1212-4212-8212-121212121212",
      allowPartial: resolved.terms.allowPartialRedemption,
      expiresAt: FUTURE,
    });
    assert.equal(issued.ok, true);
    if (!issued.ok) {
      return;
    }
    const part = await ledger.redeem(issued.voucher.id, 100, NOW);
    assert.equal(part.ok, true);
    if (part.ok) {
      assert.equal(part.voucher.remaining, 750);
    }
  });
});

describe("one redemption survives a concurrent redeem", () => {
  beforeEach(() => {
    resetLedgerIds();
  });

  it("leaves a single redemption when two full redeems overlap", async () => {
    const ledger = new VoucherLedger();
    ledger.setPaid(850);
    const issued = await ledger.issue({
      idempotencyKey: "13131313-1313-4313-8313-131313131313",
      allowPartial: true,
      expiresAt: FUTURE,
    });
    assert.equal(issued.ok, true);
    if (!issued.ok) {
      return;
    }
    const [first, second] = await Promise.all([
      ledger.redeem(issued.voucher.id, 850, NOW),
      ledger.redeem(issued.voucher.id, 850, NOW),
    ]);
    const succeeded = [first, second].filter((result) => result.ok);
    assert.equal(succeeded.length, 1);
    assert.equal(ledger.redemptions.length, 1);
    assert.equal(ledger.redemptions[0]?.amount, 850);
    assert.equal(ledger.vouchers[0]?.remaining, 0);
    assert.equal(ledger.vouchers[0]?.status, "REDEEMED");
  });

  it("does not let two partial redeems spend the same balance", async () => {
    const ledger = new VoucherLedger();
    ledger.setPaid(100);
    const issued = await ledger.issue({
      idempotencyKey: "14141414-1414-4414-8414-141414141414",
      allowPartial: true,
      expiresAt: FUTURE,
    });
    assert.equal(issued.ok, true);
    if (!issued.ok) {
      return;
    }
    const [first, second] = await Promise.all([
      ledger.redeem(issued.voucher.id, 80, NOW),
      ledger.redeem(issued.voucher.id, 80, NOW),
    ]);
    const succeeded = [first, second].filter((result) => result.ok);
    assert.equal(succeeded.length, 1);
    assert.equal(ledger.redemptions.length, 1);
    assert.equal(ledger.vouchers[0]?.remaining, 20);
  });
});

describe("refunds and redeemed vouchers", () => {
  const policy = {
    windowDays: 14,
    approver: "admin" as const,
    allowPartial: true,
    blocksIssuedVoucher: true,
  };
  const now = "2026-10-08T10:00:00.000Z";
  const paidAt = "2026-10-07T10:00:00.000Z";

  it("blocks a refund when the voucher has a redemption and the policy says so", () => {
    const release = planVoucherRefundRelease({
      policyBlocksRedemptions: true,
      fullRefund: true,
      vouchers: [
        { id: "v-1", status: "PARTIALLY_REDEEMED", amount: 100, remainingAmount: 40, redemptionCount: 1 },
      ],
    });
    assert.deepEqual(release, { block: true, cancelIds: [] });
    const decision = decideRefund({
      policy,
      actor: "admin",
      paidAt,
      now,
      chargedAmount: 100,
      alreadyRefunded: 0,
      requestedAmount: 100,
      redeemedVoucher: release.block,
      paymentStatus: "paid",
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.message, REFUND_VOUCHER_BLOCKED);
    }
  });

  it("cancels an unredeemed voucher on a full refund and leaves it on a partial refund", () => {
    const open = {
      id: "v-open",
      status: "ISSUED",
      amount: 100,
      remainingAmount: 100,
      redemptionCount: 0,
    };
    assert.equal(refundCoversRemainder(100, 0, 100), true);
    assert.deepEqual(
      planVoucherRefundRelease({
        policyBlocksRedemptions: true,
        fullRefund: true,
        vouchers: [open],
      }),
      { block: false, cancelIds: ["v-open"] },
    );
    assert.deepEqual(
      planVoucherRefundRelease({
        policyBlocksRedemptions: true,
        fullRefund: false,
        vouchers: [open],
      }),
      { block: false, cancelIds: [] },
    );
    const allowed = decideRefund({
      policy,
      actor: "admin",
      paidAt,
      now,
      chargedAmount: 100,
      alreadyRefunded: 0,
      requestedAmount: 100,
      redeemedVoucher: false,
      paymentStatus: "paid",
    });
    assert.equal(allowed.ok, true);
  });
});

describe("expired vouchers and codes", () => {
  it("refuses an expired voucher from the snapshotted expiry", () => {
    const expired = planVoucherRedeem(
      { status: "ISSUED", expiresAt: NOW - 1000, remaining: 50, allowPartial: true },
      null,
      NOW,
    );
    assert.deepEqual(expired, { ok: false, reason: "expired" });
    const balance = buildVoucherBalance({
      voucherId: "v-exp",
      amount: 50,
      remainingAmount: 50,
      status: "ISSUED",
      expiresAt: new Date(NOW - 1000).toISOString(),
      now: NOW,
      redemptions: [
        {
          id: "later",
          amount: 10,
          redeemedAt: "2026-10-02T00:00:00.000Z",
          channel: "store",
          reference: null,
        },
        {
          id: "earlier",
          amount: 5,
          redeemedAt: "2026-10-01T00:00:00.000Z",
          channel: "store",
          reference: null,
        },
      ],
    });
    assert.equal(balance.status, "EXPIRED");
    assert.deepEqual(
      balance.redemptions.map((redemption) => redemption.id),
      ["earlier", "later"],
    );
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
