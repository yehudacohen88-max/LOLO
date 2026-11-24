import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SettlementLedger } from "../lib/settlements/ledger";
import {
  earliestDueAt,
  isSettlementOverdue,
  settlementDueAt,
  splitCommission,
  sumMoney,
} from "../lib/settlements/money";
import { buildFinanceOverview, buildStoreBalances } from "../lib/settlements/overview";
import { parseSettlementPolicyInput } from "../lib/settlements/policy-input";
import { resolvePaymentTermsDays } from "../lib/settlements/policy";
import { manualPayoutProvider } from "../lib/settlements/payout";
import { buildReconciliation, reconciliationBalances } from "../lib/settlements/reconcile";
import { DEMO_SECTION_LABEL, settlementReportCsv } from "../lib/settlements/report-csv";
import { SETTLEMENT_ROUNDING_RULE } from "../lib/settlements/rounding";
import { buildStatement, statementReconciles, type StatementSource } from "../lib/settlements/statement";

const POLICY = {
  rounding: SETTLEMENT_ROUNDING_RULE,
  fallbackCommissionPercent: null as number | null,
  fallbackPaymentTermsDays: null as number | null,
};

const CASES: Array<[number, number, number, number]> = [
  [1000, 8, 80, 920],
  [10.01, 8, 0.8, 9.21],
  [33.33, 8, 2.67, 30.66],
  [1.25, 10, 0.13, 1.12],
  [0.01, 50, 0.01, 0],
  [19.99, 12.5, 2.5, 17.49],
  [100, 0, 0, 100],
  [50, 100, 50, 0],
  [850, 8.33, 70.81, 779.19],
  [999.99, 2.5, 25, 974.99],
  [1234.56, 7.75, 95.68, 1138.88],
];

describe("commission rounding", () => {
  it("splits 1,000 at 8% into 80 for LOLO and 920 for the store", () => {
    const split = splitCommission(1000, 8, POLICY.rounding);
    assert.equal(split.grossAmount, 1000);
    assert.equal(split.commissionAmount, 80);
    assert.equal(split.payableAmount, 920);
    assert.equal(sumMoney([split.commissionAmount, split.payableAmount]), 1000);
  });

  it("rounds odd amounts half up to the agora and keeps payable + commission = gross", () => {
    for (const [gross, percent, commission, payable] of CASES) {
      const split = splitCommission(gross, percent, POLICY.rounding);
      assert.equal(split.commissionAmount, commission, `${gross} at ${percent}%`);
      assert.equal(split.payableAmount, payable, `${gross} at ${percent}%`);
      assert.equal(
        sumMoney([split.commissionAmount, split.payableAmount]),
        split.grossAmount,
      );
      assert.ok(split.commissionAmount >= 0);
      assert.ok(split.payableAmount >= 0);
    }
    assert.throws(
      () => splitCommission(100, null, POLICY.rounding),
      /settlement_commission_unspecified/,
    );
    assert.equal(splitCommission(100, 0, POLICY.rounding).commissionSpecified, true);
    assert.throws(
      () => splitCommission(100, 8, null),
      /settlement_rounding_unspecified/,
    );
  });
});

describe("due dates use snapshotted payment terms", () => {
  it("adds payment terms to the redemption time, and the batch is due at the earliest line", () => {
    const early = settlementDueAt("2026-10-01T00:00:00.000Z", 30);
    const sooner = settlementDueAt("2026-10-20T00:00:00.000Z", 0);
    const explicitNow = settlementDueAt(
      "2026-10-01T00:00:00.000Z",
      resolvePaymentTermsDays(null, { ...POLICY, fallbackPaymentTermsDays: 0 }).days,
    );
    assert.equal(early, "2026-10-31T00:00:00.000Z");
    assert.equal(sooner, "2026-10-20T00:00:00.000Z");
    assert.equal(explicitNow, "2026-10-01T00:00:00.000Z");
    assert.throws(
      () => settlementDueAt("2026-10-01T00:00:00.000Z", null),
      /settlement_terms_unspecified/,
    );
    assert.equal(earliestDueAt([early, sooner]), sooner);
    assert.equal(
      isSettlementOverdue("PENDING", early, Date.parse("2026-11-01T00:00:00.000Z")),
      true,
    );
    assert.equal(
      isSettlementOverdue("PAID", early, Date.parse("2026-11-01T00:00:00.000Z")),
      false,
    );
  });
});

describe("settlement batches", () => {
  const store = "store-1";

  function seed(ledger: SettlementLedger) {
    ledger.addRedemption({
      id: "redemption-1000",
      storeId: store,
      voucherId: "voucher-full",
      fullyRedeemed: true,
      gross: 1000,
      commissionPercent: 8,
      paymentTermsDays: 30,
      redeemedAt: "2026-10-01T00:00:00.000Z",
    });
    ledger.addRedemption({
      id: "redemption-odd",
      storeId: store,
      voucherId: "voucher-odd",
      fullyRedeemed: true,
      gross: 10.01,
      commissionPercent: 8,
      paymentTermsDays: 0,
      redeemedAt: "2026-10-20T00:00:00.000Z",
    });
    ledger.addRedemption({
      id: "redemption-other",
      storeId: "store-2",
      voucherId: "voucher-other",
      fullyRedeemed: true,
      gross: 500,
      commissionPercent: 10,
      paymentTermsDays: 45,
      redeemedAt: "2026-10-02T00:00:00.000Z",
    });
  }

  it("never puts one redemption in two settlements, even when creation races", async () => {
    const ledger = new SettlementLedger(POLICY);
    seed(ledger);
    const [first, second] = await Promise.all([
      ledger.create(store, "key-a"),
      ledger.create(store, "key-b"),
    ]);
    const created = [first, second].filter((result) => result.ok);
    assert.equal(created.length, 1);
    assert.equal(ledger.settlements.length, 1);
    assert.deepEqual(ledger.activeRedemptionIds().sort(), ["redemption-1000", "redemption-odd"]);
    assert.equal(new Set(ledger.activeRedemptionIds()).size, ledger.activeRedemptionIds().length);

    const again = await ledger.create(store, "key-c");
    assert.deepEqual(again, { ok: false, reason: "none" });
    assert.equal(ledger.settlements.length, 1);

    const replayKey = first.ok ? "key-a" : "key-b";
    const replay = await ledger.create(store, replayKey);
    assert.equal(replay.ok, true);
    if (replay.ok && created[0]?.ok) {
      assert.equal(replay.idempotent, true);
      assert.equal(replay.settlement.id, created[0].settlement.id);
    }
    assert.equal(ledger.settlements.length, 1);
  });

  it("keeps payable + commission = gross and sets the due date from the earliest redemption", async () => {
    const ledger = new SettlementLedger(POLICY);
    seed(ledger);
    const created = await ledger.create(store, "batch-1");
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.equal(created.settlement.grossAmount, 1010.01);
    assert.equal(created.settlement.commissionAmount, 80.8);
    assert.equal(created.settlement.payableAmount, 929.21);
    assert.equal(
      sumMoney([created.settlement.commissionAmount, created.settlement.payableAmount]),
      created.settlement.grossAmount,
    );
    for (const line of created.settlement.lines) {
      assert.equal(sumMoney([line.commissionAmount, line.payableAmount]), line.grossAmount);
    }
    assert.equal(created.settlement.dueAt, "2026-10-20T00:00:00.000Z");
    assert.equal(ledger.voucherStatus("voucher-full"), "SETTLEMENT_PENDING");
    assert.equal(ledger.activeRedemptionIds().includes("redemption-other"), false);
  });

  it("marks a settlement paid once and leaves the first payment record in place", async () => {
    const ledger = new SettlementLedger(POLICY);
    seed(ledger);
    const created = await ledger.create(store, "batch-paid");
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }

    const paidAt = "2026-11-01T09:00:00.000Z";
    const first = await ledger.markPaid(created.settlement.id, {
      reference: "transfer-100",
      method: "bank_transfer",
      now: paidAt,
    });
    const second = await ledger.markPaid(created.settlement.id, {
      reference: "transfer-200",
      method: "manual",
      now: "2026-12-01T09:00:00.000Z",
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }
    assert.equal(first.idempotent, false);
    assert.equal(second.idempotent, true);
    assert.equal(second.settlement.paidAt, paidAt);
    assert.equal(second.settlement.paymentReference, "transfer-100");
    assert.equal(second.settlement.paymentMethod, "bank_transfer");
    assert.equal(second.settlement.status, "PAID");
    assert.equal(ledger.voucherStatus("voucher-full"), "SETTLED");
    assert.equal(ledger.voucherStatus("voucher-odd"), "SETTLED");

    const cancelled = await ledger.cancel(created.settlement.id);
    assert.deepEqual(cancelled, { ok: false, reason: "paid" });
    assert.equal(ledger.activeRedemptionIds().length, 2);
  });

  it("releases redemptions when a pending settlement is cancelled, then allows one new batch", async () => {
    const ledger = new SettlementLedger(POLICY);
    seed(ledger);
    const created = await ledger.create(store, "batch-cancel");
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const cancelled = await ledger.cancel(created.settlement.id);
    assert.equal(cancelled.ok, true);
    assert.equal(ledger.activeRedemptionIds().length, 0);
    assert.equal(ledger.voucherStatus("voucher-full"), "REDEEMED");

    const again = await ledger.cancel(created.settlement.id);
    assert.equal(again.ok, true);
    if (again.ok) {
      assert.equal(again.idempotent, true);
    }

    const next = await ledger.create(store, "batch-after-cancel");
    assert.equal(next.ok, true);
    assert.equal(ledger.settlements.length, 2);
    assert.deepEqual(ledger.activeRedemptionIds().sort(), ["redemption-1000", "redemption-odd"]);
    const activeLines = ledger.settlements.flatMap((settlement) =>
      settlement.lines.filter((line) => !line.released).map((line) => line.redemptionId),
    );
    assert.equal(new Set(activeLines).size, activeLines.length);
  });
});

describe("LOLO revenue keeps guest fees out of the store payable", () => {
  it("adds guest fees to store commission for LOLO, and not to the amount owed to the store", () => {
    const { overview, overdue } = buildFinanceOverview({
      eventCount: 2,
      giftCount: 3,
      activeStores: 1,
      inactiveStores: 0,
      orderCount: 4,
      paidOrders: [
        { contribution: 1000, fee: 50 },
        { contribution: 10.01, fee: 1.5 },
      ],
      vouchers: [
        { amount: 1000, status: "REDEEMED" },
        { amount: 10.01, status: "SETTLED" },
        { amount: 40, status: "CANCELLED" },
      ],
      redemptions: [
        { amount: 1000, commissionPercent: 8, settlementStatus: "UNSETTLED" },
        { amount: 10.01, commissionPercent: 8, settlementStatus: "SETTLEMENT_PENDING" },
      ],
      settlements: [
        {
          id: "settlement-1",
          storeName: "חנות",
          status: "PENDING",
          dueAt: "2026-10-01T00:00:00.000Z",
          grossAmount: 10.01,
          commissionAmount: 0.8,
          payableAmount: 9.21,
        },
      ],
      now: Date.parse("2026-10-07T00:00:00.000Z"),
      policy: POLICY,
    });

    assert.equal(overview.paidContribution, 1010.01);
    assert.equal(overview.guestFeeRevenue, 51.5);
    assert.equal(overview.vouchersIssuedAmount, 1010.01);
    assert.equal(overview.vouchersIssuedCount, 2);
    assert.equal(overview.storeCommission, 80.8);
    assert.equal(overview.loloRevenue, 132.3);
    assert.equal(overview.payableUnsettled, 920);
    assert.equal(overview.payablePending, 9.21);
    assert.equal(overview.payableOutstanding, 929.21);
    assert.equal(overview.overdueCount, 1);
    assert.equal(overdue[0]?.payableAmount, 9.21);
    assert.notEqual(overview.payableOutstanding, sumMoney([overview.payableOutstanding, overview.guestFeeRevenue]));
  });

  it("rolls unsettled, pending, and paid amounts up per store", () => {
    const balances = buildStoreBalances(
      [{ id: "store-1", name: "חנות" }],
      [{ storeId: "store-1", amount: 1000, commissionPercent: 8 }],
      [
        { storeId: "store-1", status: "PENDING", payableAmount: 9.21 },
        { storeId: "store-1", status: "PAID", payableAmount: 100 },
      ],
      POLICY,
    );
    assert.equal(balances.length, 1);
    assert.equal(balances[0]?.unsettledPayable, 920);
    assert.equal(balances[0]?.unsettledCommission, 80);
    assert.equal(balances[0]?.unsettledCount, 1);
    assert.equal(balances[0]?.pendingPayable, 9.21);
    assert.equal(balances[0]?.paidPayable, 100);
  });
});

describe("demo redemptions stay out of a batch", () => {
  it("leaves a demo redemption UNSETTLED and out of the payable total", async () => {
    const ledger = new SettlementLedger(POLICY);
    ledger.addRedemption({
      id: "demo-redemption",
      storeId: "store-1",
      voucherId: "voucher-demo",
      fullyRedeemed: true,
      gross: 400,
      commissionPercent: null,
      paymentTermsDays: null,
      redeemedAt: "2026-10-01T00:00:00.000Z",
      demoOnly: true,
    });
    ledger.addRedemption({
      id: "real-redemption",
      storeId: "store-1",
      voucherId: "voucher-real",
      fullyRedeemed: true,
      gross: 1000,
      commissionPercent: 8,
      paymentTermsDays: 30,
      redeemedAt: "2026-10-01T00:00:00.000Z",
    });

    const created = await ledger.create("store-1", "batch-demo");
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.deepEqual(
      created.settlement.lines.map((line) => line.redemptionId),
      ["real-redemption"],
    );
    assert.equal(created.settlement.grossAmount, 1000);
    assert.equal(created.settlement.commissionAmount, 80);
    assert.equal(created.settlement.payableAmount, 920);
    assert.equal(
      sumMoney([created.settlement.commissionAmount, created.settlement.payableAmount]),
      created.settlement.grossAmount,
    );
    assert.equal(ledger.redemptionStatus("demo-redemption"), "UNSETTLED");
    assert.equal(ledger.redemptionStatus("real-redemption"), "SETTLEMENT_PENDING");

    const onlyDemo = new SettlementLedger(POLICY);
    onlyDemo.addRedemption({
      id: "demo-only",
      storeId: "store-1",
      voucherId: "voucher-demo",
      fullyRedeemed: true,
      gross: 50,
      commissionPercent: 8,
      paymentTermsDays: 0,
      redeemedAt: "2026-10-02T00:00:00.000Z",
      demoOnly: true,
    });
    const skipped = await onlyDemo.create("store-1", "batch-only-demo");
    assert.deepEqual(skipped, { ok: false, reason: "none" });
    assert.equal(onlyDemo.redemptionStatus("demo-only"), "UNSETTLED");
    assert.equal(onlyDemo.settlements.length, 0);
  });
});

describe("null commission is refused", () => {
  it("does not treat a missing snapshot as 0% and does not open a batch", async () => {
    const ledger = new SettlementLedger(POLICY);
    ledger.addRedemption({
      id: "missing-commission",
      storeId: "store-1",
      voucherId: "voucher-1",
      fullyRedeemed: true,
      gross: 1000,
      commissionPercent: null,
      paymentTermsDays: 30,
      redeemedAt: "2026-10-01T00:00:00.000Z",
    });
    await assert.rejects(() => ledger.create("store-1", "batch-null"), /settlement_commission_unspecified/);
    assert.equal(ledger.settlements.length, 0);
    assert.equal(ledger.redemptionStatus("missing-commission"), "UNSETTLED");
  });

  it("uses an explicit platform default and still reconciles the total", async () => {
    const ledger = new SettlementLedger({
      ...POLICY,
      fallbackCommissionPercent: 8,
      fallbackPaymentTermsDays: 30,
    });
    ledger.addRedemption({
      id: "fallback-commission",
      storeId: "store-1",
      voucherId: "voucher-1",
      fullyRedeemed: true,
      gross: 1000,
      commissionPercent: null,
      paymentTermsDays: null,
      redeemedAt: "2026-10-01T00:00:00.000Z",
    });
    const created = await ledger.create("store-1", "batch-fallback");
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.equal(created.settlement.commissionAmount, 80);
    assert.equal(created.settlement.payableAmount, 920);
    assert.equal(created.settlement.dueAt, "2026-10-31T00:00:00.000Z");
    assert.equal(
      sumMoney([created.settlement.commissionAmount, created.settlement.payableAmount]),
      created.settlement.grossAmount,
    );
  });

  it("does not turn an empty settings field into 0%", () => {
    const parsed = parseSettlementPolicyInput({
      defaultCommissionPercent: "",
      defaultPaymentTermsDays: "",
      moneyRounding: "",
    });
    assert.equal(parsed.fallbackCommissionPercent, null);
    assert.equal(parsed.fallbackPaymentTermsDays, null);
    assert.equal(parsed.rounding, null);
    assert.throws(
      () => parseSettlementPolicyInput({ moneyRounding: "half_up" }),
      /כלל העיגול/,
    );
  });
});

describe("statement totals reconcile and demo is labeled", () => {
  const sources: StatementSource[] = [
    {
      id: "real",
      storeId: "store-1",
      storeName: "חנות",
      gross: 1000,
      commissionPercent: 8,
      paymentTermsDays: 30,
      redeemedAt: "2026-10-01T00:00:00.000Z",
      voucherCode: "REAL",
      giftTitle: "מתנה",
      eventTitle: "אירוע",
      demoOnly: false,
      settlementId: "settlement-1",
      settlementStatus: "SETTLED",
      paidAt: "2026-11-01T00:00:00.000Z",
      paymentReference: "transfer-1",
      paymentMethod: "bank_transfer",
      stored: {
        commissionPercent: 8,
        commissionSpecified: true,
        commissionAmount: 80,
        payableAmount: 920,
        paymentTermsDays: 30,
        termsSpecified: true,
        dueAt: "2026-10-31T00:00:00.000Z",
      },
    },
    {
      id: "demo",
      storeId: "store-1",
      storeName: "חנות",
      gross: 400,
      commissionPercent: null,
      paymentTermsDays: null,
      redeemedAt: "2026-10-02T00:00:00.000Z",
      voucherCode: "DEMO",
      giftTitle: "הדגמה",
      eventTitle: "אירוע",
      demoOnly: true,
      settlementId: null,
      settlementStatus: "UNSETTLED",
      paidAt: null,
      paymentReference: null,
      paymentMethod: null,
      stored: null,
    },
    {
      id: "missing",
      storeId: "store-1",
      storeName: "חנות",
      gross: 50,
      commissionPercent: null,
      paymentTermsDays: 0,
      redeemedAt: "2026-10-03T00:00:00.000Z",
      voucherCode: "NONE",
      giftTitle: "בלי עמלה",
      eventTitle: "אירוע",
      demoOnly: false,
      settlementId: null,
      settlementStatus: "UNSETTLED",
      paidAt: null,
      paymentReference: null,
      paymentMethod: null,
      stored: null,
    },
  ];

  it("keeps demo and a null commission out of the payable total", () => {
    const statement = buildStatement(sources, POLICY);
    assert.equal(statementReconciles(statement.totals), true);
    assert.equal(statement.totals.payableGross, 1000);
    assert.equal(statement.totals.payableCommission, 80);
    assert.equal(statement.totals.payableAmount, 920);
    assert.equal(statement.totals.demoGross, 400);
    assert.equal(statement.totals.demoCount, 1);
    assert.equal(statement.totals.blockedCount, 1);
    assert.equal(statement.rows.find((row) => row.id === "demo")?.section, "demo");
    assert.equal(statement.rows.find((row) => row.id === "demo")?.payableAmount, null);
    assert.equal(statement.rows.find((row) => row.id === "missing")?.section, "blocked");

    const report = buildReconciliation(statement.rows, [
      {
        id: "settlement-1",
        storeId: "store-1",
        storeName: "חנות",
        status: "PAID",
        grossAmount: 1000,
        commissionAmount: 80,
        payableAmount: 920,
        paymentReference: "transfer-1",
        lineRedemptionIds: ["real"],
      },
    ]);
    assert.equal(reconciliationBalances(report), true);
    assert.equal(report.markedPaid, 920);
    assert.equal(report.settledFromLines, 920);
    assert.equal(report.expectedOutstanding, 0);
    assert.equal(report.discrepancies.some((item) => item.kind === "amount"), false);
    assert.equal(report.discrepancies.some((item) => item.kind === "blocked"), true);

    const csv = settlementReportCsv(statement.rows);
    assert.match(csv, new RegExp(DEMO_SECTION_LABEL));
    assert.match(csv, /DEMO/);
    assert.doesNotMatch(csv, /DEMO,[\s\S]*400,8,/);
  });

  it("reports a discrepancy when marked-paid does not match the lines", () => {
    const statement = buildStatement(sources.filter((source) => source.id === "real"), POLICY);
    const report = buildReconciliation(statement.rows, [
      {
        id: "settlement-1",
        storeId: "store-1",
        storeName: "חנות",
        status: "PAID",
        grossAmount: 1000,
        commissionAmount: 80,
        payableAmount: 900,
        paymentReference: null,
        lineRedemptionIds: ["real"],
      },
    ]);
    assert.equal(reconciliationBalances(report), false);
    assert.equal(report.markedPaid, 900);
    assert.equal(report.settledFromLines, 920);
    assert.equal(report.discrepancies.some((item) => item.kind === "amount"), true);
    assert.equal(report.discrepancies.some((item) => item.kind === "reference"), true);
  });
});

describe("manual payout provider", () => {
  it("records the operator mark and does not call the network", async () => {
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = async () => {
      calls.push("fetch");
      throw new Error("payout provider called the network");
    };
    try {
      const receipt = await manualPayoutProvider.recordOperatorMark({
        settlementId: "settlement-1",
        reference: "transfer-1",
        method: "manual",
      });
      assert.equal(manualPayoutProvider.movesMoney, false);
      assert.equal(receipt.recorded, true);
      assert.equal(receipt.movedMoney, false);
      assert.equal(receipt.externalCall, false);
      assert.equal(calls.length, 0);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("settlement SQL excludes demo and refuses a null commission", () => {
  const sql = readFileSync(new URL("../supabase/settlement-exclude-demo.sql", import.meta.url), "utf8");

  it("matches the shared rounding rule and does not invent a rate", () => {
    assert.match(sql, new RegExp(SETTLEMENT_ROUNDING_RULE));
    assert.match(sql, /v\.demo_only is not true/);
    assert.match(sql, /settlement_demo_excluded/);
    assert.match(sql, /settlement_commission_unspecified/);
    assert.match(sql, /settlement_terms_unspecified/);
    assert.match(sql, /settlement_rounding_unspecified/);
    assert.match(sql, /create or replace function public\.create_store_settlement/);
    assert.doesNotMatch(sql, /coalesce\(\s*p_percent\s*,\s*0\s*\)/);
    assert.doesNotMatch(sql, /coalesce\(\s*redemption\.commission_percent_snapshot\s*,\s*0\s*\)/);
    assert.doesNotMatch(sql, /coalesce\(\s*redemption\.payment_terms_days_snapshot\s*,\s*0\s*\)/);
    assert.doesNotMatch(sql, /add column if not exists demo_only/);
  });
});

