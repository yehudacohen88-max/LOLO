import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { guestCheckoutAllowed } from "../lib/guest-draft";
import { guestItemsProblem } from "../lib/orders/guest-input";
import {
  DEMO_MONEY_LABEL,
  DEMO_VOUCHER_LABEL,
  allocateVoucherPools,
  hostMoneyPresentation,
  isRealMoneyPayment,
  isSimulatedPayment,
  planFundedRedeem,
  planFundedVoucherIssue,
  sumPaidPools,
} from "../lib/vouchers/demo-funding";
import { voucherErrorMessage } from "../lib/vouchers/messages";

const demoPaid = {
  amount: 350,
  paymentStatus: "paid",
  paymentProvider: "demo",
  paymentReference: "demo-abc",
};

const realPaid = {
  amount: 350,
  paymentStatus: "paid",
  paymentProvider: "cardcom",
  paymentReference: "pay-100",
};

describe("demo funding is not money", () => {
  it("treats demo, blank, and demo references as simulated", () => {
    assert.equal(isSimulatedPayment(demoPaid), true);
    assert.equal(isRealMoneyPayment(demoPaid), false);
    assert.equal(
      isSimulatedPayment({ ...demoPaid, paymentProvider: null, paymentReference: null }),
      true,
    );
    assert.equal(
      isSimulatedPayment({ ...demoPaid, paymentProvider: "  ", paymentReference: null }),
      true,
    );
    assert.equal(
      isSimulatedPayment({ ...realPaid, paymentReference: "demo-slipped" }),
      true,
    );
    assert.equal(isSimulatedPayment(realPaid), true);
    assert.equal(isRealMoneyPayment(realPaid), false);
    assert.equal(isSimulatedPayment(realPaid, ["cardcom"]), false);
    assert.equal(isRealMoneyPayment(realPaid, ["cardcom"]), true);
    assert.equal(
      isSimulatedPayment({ ...realPaid, paymentReference: "demo-slipped" }, ["cardcom"]),
      true,
    );
    assert.equal(isSimulatedPayment({ ...realPaid, paymentStatus: "pending" }), false);
    assert.equal(sumPaidPools([realPaid]).realPaid, 0);
    assert.equal(sumPaidPools([realPaid]).simulatedPaid, 350);
  });

  it("refuses to redeem a demo-funded pool", () => {
    assert.equal(isSimulatedPayment(demoPaid), true);
    assert.deepEqual(
      planFundedRedeem({
        demoOnly: true,
        voucherAmount: 200,
        realPaid: 0,
        simulatedPaid: 200,
        monetaryCommitted: 0,
        fundingKnown: true,
      }),
      { ok: false, reason: "demo" },
    );
    assert.deepEqual(
      planFundedRedeem({
        demoOnly: null,
        voucherAmount: 200,
        realPaid: 0,
        simulatedPaid: 200,
        monetaryCommitted: 200,
        fundingKnown: true,
      }),
      { ok: false, reason: "demo" },
    );
  });

  it("blocks a monetary issue and a redeem when funding is demo", () => {
    const sums = sumPaidPools([demoPaid, { ...demoPaid, amount: 50, paymentStatus: "pending" }]);
    assert.deepEqual(sums, { realPaid: 0, simulatedPaid: 350 });

    const blocked = planFundedVoucherIssue({
      ...sums,
      vouchers: [],
      expectedAmount: 350,
      guardReady: false,
      fundingKnown: true,
    });
    assert.deepEqual(blocked, { ok: false, reason: "demo-blocked" });

    const direct = planFundedVoucherIssue({
      realPaid: 0,
      simulatedPaid: 350,
      vouchers: [],
      expectedAmount: 350,
      guardReady: false,
      fundingKnown: true,
    });
    assert.equal(direct.ok, false);

    const redeem = planFundedRedeem({
      demoOnly: null,
      voucherAmount: 350,
      realPaid: 0,
      simulatedPaid: 350,
      monetaryCommitted: 350,
      fundingKnown: true,
    });
    assert.deepEqual(redeem, { ok: false, reason: "demo" });
    assert.match(voucherErrorMessage("voucher_demo_blocked"), new RegExp(DEMO_VOUCHER_LABEL));
  });

  it("issues a non-redeemable demo voucher only after the database guard exists", () => {
    const issued = planFundedVoucherIssue({
      realPaid: 0,
      simulatedPaid: 350,
      vouchers: [],
      expectedAmount: 350,
      guardReady: true,
      fundingKnown: true,
    });
    assert.deepEqual(issued, { ok: true, kind: "demo", amount: 350 });

    const redeem = planFundedRedeem({
      demoOnly: true,
      voucherAmount: 350,
      realPaid: 0,
      simulatedPaid: 350,
      monetaryCommitted: 0,
      fundingKnown: true,
    });
    assert.deepEqual(redeem, { ok: false, reason: "demo" });
  });

  it("does not issue the same demo payment twice", () => {
    const pools = allocateVoucherPools({
      realPaid: 0,
      simulatedPaid: 350,
      vouchers: [{ amount: 350, status: "ISSUED", demoOnly: false }],
    });
    assert.equal(pools.demoAvailable, 0);
    assert.equal(pools.monetaryAvailable, 0);
    const again = planFundedVoucherIssue({
      realPaid: 0,
      simulatedPaid: 350,
      vouchers: [{ amount: 350, status: "ISSUED", demoOnly: true }],
      expectedAmount: 350,
      guardReady: true,
      fundingKnown: true,
    });
    assert.deepEqual(again, { ok: false, reason: "none" });
  });

  it("keeps a real-provider voucher issuable and redeemable", () => {
    const sums = sumPaidPools([realPaid, demoPaid], ["cardcom"]);
    assert.equal(sums.realPaid, 350);
    assert.equal(sums.simulatedPaid, 350);

    const withoutGuard = planFundedVoucherIssue({
      realPaid: 350,
      simulatedPaid: 0,
      vouchers: [],
      expectedAmount: 350,
      guardReady: false,
      fundingKnown: true,
    });
    assert.deepEqual(withoutGuard, { ok: true, kind: "monetary", amount: 350 });

    const mixedBlocked = planFundedVoucherIssue({
      realPaid: 350,
      simulatedPaid: 350,
      vouchers: [],
      expectedAmount: 700,
      guardReady: false,
      fundingKnown: true,
    });
    assert.deepEqual(mixedBlocked, { ok: false, reason: "demo-blocked" });

    const mixedReady = planFundedVoucherIssue({
      realPaid: 350,
      simulatedPaid: 350,
      vouchers: [],
      expectedAmount: 350,
      guardReady: true,
      fundingKnown: true,
    });
    assert.deepEqual(mixedReady, { ok: true, kind: "monetary", amount: 350 });

    const redeem = planFundedRedeem({
      demoOnly: false,
      voucherAmount: 350,
      realPaid: 350,
      simulatedPaid: 350,
      monetaryCommitted: 350,
      fundingKnown: true,
    });
    assert.deepEqual(redeem, { ok: true });
  });

  it("fails closed when the provider cannot be read", () => {
    assert.deepEqual(
      planFundedVoucherIssue({
        realPaid: 0,
        simulatedPaid: 0,
        vouchers: [],
        expectedAmount: 100,
        guardReady: true,
        fundingKnown: false,
      }),
      { ok: false, reason: "demo-blocked" },
    );
    assert.deepEqual(
      planFundedRedeem({
        demoOnly: false,
        voucherAmount: 100,
        realPaid: 100,
        simulatedPaid: 0,
        monetaryCommitted: 100,
        fundingKnown: false,
      }),
      { ok: false, reason: "demo" },
    );
  });

  it("labels simulated host totals and leaves real totals unlabeled", () => {
    assert.equal(hostMoneyPresentation(0, 350).tone, "simulated");
    assert.equal(hostMoneyPresentation(0, 350).caption, DEMO_MONEY_LABEL);
    assert.equal(hostMoneyPresentation(200, 50).tone, "mixed");
    assert.equal(hostMoneyPresentation(200, 0).caption, "");
    assert.equal(hostMoneyPresentation(200, 0).tone, "real");
  });
});

describe("guest checkout cannot start at zero", () => {
  it("blocks an empty selection and a zero amount", () => {
    assert.equal(guestCheckoutAllowed(0), false);
    assert.equal(guestCheckoutAllowed(-1), false);
    assert.equal(guestCheckoutAllowed(Number.NaN), false);
    assert.equal(guestCheckoutAllowed(50), true);
    assert.equal(guestItemsProblem([]), "עדיין לא נבחרה מתנה.");
    assert.equal(
      guestItemsProblem([{ giftId: "gift-1", amount: 0 }]),
      "עדיין לא נבחרה מתנה.",
    );
    assert.equal(guestItemsProblem([{ giftId: "gift-1", amount: 40 }]), null);
  });

  it("does not offer the unused gift-confirmation checkbox", () => {
    const form = readFileSync(
      new URL("../app/e/[slug]/details/guest-details-form.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(form.includes("אני רוצה לקבל אישור על המתנה"), false);
    assert.equal(form.includes("type=\"checkbox\""), false);
    const greeting = readFileSync(
      new URL("../app/e/[slug]/greeting/greeting-form.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(greeting.includes("guestCheckoutAllowed"), true);
    assert.equal(greeting.includes("ממשיכים · {formatGiftAmount(total)}"), true);
  });
});

describe("demo guard SQL does not treat an unknown provider as money", () => {
  it("keeps payment_provider_allowlist empty and replays an issue key before planning", () => {
    const sql = readFileSync(new URL("../supabase/pilot-demo-voucher-guard.sql", import.meta.url), "utf8");
    assert.match(sql, /create table if not exists public\.payment_provider_allowlist/);
    assert.match(sql, /provider <> 'demo'/);
    assert.match(sql, /provider <> 'none'/);
    assert.match(sql, /function public\.payment_provider_is_real/);
    assert.match(sql, /public\.payment_provider_is_real\(o\.payment_provider\)/);
    assert.doesNotMatch(sql, /name other than "demo"/);
    const seed = readFileSync(new URL("../supabase/demo-seed.sql", import.meta.url), "utf8");
    assert.match(seed, /voucher_demo_guard_version\(\)/);
    const repository = readFileSync(new URL("../lib/vouchers/repository.ts", import.meta.url), "utf8");
    const issue = repository.slice(repository.indexOf("export async function issueGiftVoucher"));
    const replay = issue.indexOf("idempotency_key");
    const plan = issue.indexOf("planFundedVoucherIssue");
    assert.ok(replay > 0 && plan > replay);
  });
});
