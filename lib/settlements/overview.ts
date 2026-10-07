import { sumMoney, splitCommission, isSettlementOverdue } from "@/lib/settlements/money";
import type { StoreBalance } from "@/lib/settlements/types";

export type FinanceOverview = {
  eventCount: number;
  giftCount: number;
  activeStores: number;
  inactiveStores: number;
  orderCount: number;
  paidOrderCount: number;
  paidContribution: number;
  guestFeeRevenue: number;
  vouchersIssuedCount: number;
  vouchersIssuedAmount: number;
  redeemedCount: number;
  redeemedAmount: number;
  storeCommission: number;
  loloRevenue: number;
  payableUnsettled: number;
  payablePending: number;
  payablePaid: number;
  payableOutstanding: number;
  overdueCount: number;
  overduePayable: number;
};

export type OverviewOrder = {
  contribution: number;
  fee: number;
};

export type OverviewVoucher = {
  amount: number;
  status: string;
};

export type OverviewRedemption = {
  amount: number;
  commissionPercent: number | null;
  settlementStatus: string;
};

export type OverviewSettlement = {
  id: string;
  storeName: string;
  status: string;
  dueAt: string;
  grossAmount: number;
  commissionAmount: number;
  payableAmount: number;
};

export type OverdueSettlement = {
  id: string;
  storeName: string;
  dueAt: string;
  payableAmount: number;
};

export function buildFinanceOverview(input: {
  eventCount: number;
  giftCount: number;
  activeStores: number;
  inactiveStores: number;
  orderCount: number;
  paidOrders: OverviewOrder[];
  vouchers: OverviewVoucher[];
  redemptions: OverviewRedemption[];
  settlements: OverviewSettlement[];
  now?: number;
}): { overview: FinanceOverview; overdue: OverdueSettlement[] } {
  const now = input.now ?? Date.now();
  const paidContribution = sumMoney(input.paidOrders.map((order) => order.contribution));
  const guestFeeRevenue = sumMoney(input.paidOrders.map((order) => order.fee));

  const issued = input.vouchers.filter((voucher) => voucher.status !== "CANCELLED");
  const vouchersIssuedAmount = sumMoney(issued.map((voucher) => voucher.amount));

  const redemptionSplits = input.redemptions.map((redemption) =>
    splitCommission(redemption.amount, redemption.commissionPercent),
  );
  const redeemedAmount = sumMoney(redemptionSplits.map((split) => split.grossAmount));
  const storeCommission = sumMoney(redemptionSplits.map((split) => split.commissionAmount));

  const unsettledPayable = sumMoney(
    input.redemptions.flatMap((redemption, index) =>
      redemption.settlementStatus === "UNSETTLED"
        ? [redemptionSplits[index]?.payableAmount ?? 0]
        : [],
    ),
  );

  const pending = input.settlements.filter((settlement) => settlement.status === "PENDING");
  const paid = input.settlements.filter((settlement) => settlement.status === "PAID");
  const payablePending = sumMoney(pending.map((settlement) => settlement.payableAmount));
  const payablePaid = sumMoney(paid.map((settlement) => settlement.payableAmount));

  const overdueRows = pending
    .filter((settlement) => isSettlementOverdue(settlement.status, settlement.dueAt, now))
    .sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1));

  return {
    overview: {
      eventCount: input.eventCount,
      giftCount: input.giftCount,
      activeStores: input.activeStores,
      inactiveStores: input.inactiveStores,
      orderCount: input.orderCount,
      paidOrderCount: input.paidOrders.length,
      paidContribution,
      guestFeeRevenue,
      vouchersIssuedCount: issued.length,
      vouchersIssuedAmount,
      redeemedCount: input.redemptions.length,
      redeemedAmount,
      storeCommission,
      loloRevenue: sumMoney([guestFeeRevenue, storeCommission]),
      payableUnsettled: unsettledPayable,
      payablePending,
      payablePaid,
      payableOutstanding: sumMoney([unsettledPayable, payablePending]),
      overdueCount: overdueRows.length,
      overduePayable: sumMoney(overdueRows.map((settlement) => settlement.payableAmount)),
    },
    overdue: overdueRows.map((settlement) => ({
      id: settlement.id,
      storeName: settlement.storeName,
      dueAt: settlement.dueAt,
      payableAmount: settlement.payableAmount,
    })),
  };
}

export function buildStoreBalances(
  stores: { id: string; name: string }[],
  unsettled: { storeId: string; amount: number; commissionPercent: number | null }[],
  settlements: { storeId: string; status: string; payableAmount: number }[],
): StoreBalance[] {
  const byStore = new Map<string, StoreBalance>();

  function ensure(storeId: string, storeName: string) {
    const existing = byStore.get(storeId);
    if (existing) {
      if (!existing.storeName && storeName) {
        existing.storeName = storeName;
      }
      return existing;
    }
    const created: StoreBalance = {
      storeId,
      storeName: storeName || "בית עסק",
      unsettledCount: 0,
      unsettledGross: 0,
      unsettledCommission: 0,
      unsettledPayable: 0,
      pendingCount: 0,
      pendingPayable: 0,
      paidCount: 0,
      paidPayable: 0,
    };
    byStore.set(storeId, created);
    return created;
  }

  for (const store of stores) {
    ensure(store.id, store.name);
  }

  const unsettledByStore = new Map<string, { gross: number[]; commission: number[]; payable: number[] }>();
  for (const redemption of unsettled) {
    const split = splitCommission(redemption.amount, redemption.commissionPercent);
    const bucket = unsettledByStore.get(redemption.storeId) ?? {
      gross: [],
      commission: [],
      payable: [],
    };
    bucket.gross.push(split.grossAmount);
    bucket.commission.push(split.commissionAmount);
    bucket.payable.push(split.payableAmount);
    unsettledByStore.set(redemption.storeId, bucket);
    const row = ensure(redemption.storeId, "");
    row.unsettledCount += 1;
  }

  for (const [storeId, bucket] of unsettledByStore) {
    const row = ensure(storeId, "");
    row.unsettledGross = sumMoney(bucket.gross);
    row.unsettledCommission = sumMoney(bucket.commission);
    row.unsettledPayable = sumMoney(bucket.payable);
  }

  for (const settlement of settlements) {
    const row = ensure(settlement.storeId, "");
    if (settlement.status === "PENDING") {
      row.pendingCount += 1;
      row.pendingPayable = sumMoney([row.pendingPayable, settlement.payableAmount]);
    } else if (settlement.status === "PAID") {
      row.paidCount += 1;
      row.paidPayable = sumMoney([row.paidPayable, settlement.payableAmount]);
    }
  }

  return [...byStore.values()].sort((a, b) => {
    if (a.unsettledPayable !== b.unsettledPayable) {
      return b.unsettledPayable - a.unsettledPayable;
    }
    return a.storeName.localeCompare(b.storeName, "he");
  });
}
