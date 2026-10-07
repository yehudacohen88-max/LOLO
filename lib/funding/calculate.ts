import { roundMoney } from "@/lib/money";

export type FundingPaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type FundingOrder = {
  id: string;
  paymentStatus: FundingPaymentStatus;
};

export type FundingItem = {
  orderId: string;
  giftId: string;
  amount: number;
};

export type FundingGift = {
  id: string;
  targetAmount: number | null;
};

export type GiftFundingProgress = {
  giftId: string;
  raisedAmount: number;
  pendingAmount: number;
  contributorCount: number;
  /** Null when the gift has no positive target. May be greater than 100. */
  percentOfTarget: number | null;
};

export type EventFunding = {
  paidAmount: number;
  pendingAmount: number;
  paidOrderCount: number;
  pendingOrderCount: number;
  gifts: GiftFundingProgress[];
};

function fundingPercent(raisedAmount: number, targetAmount: number | null) {
  if (targetAmount == null || !(targetAmount > 0)) {
    return null;
  }
  return roundMoney((raisedAmount / targetAmount) * 100);
}

/**
 * Funded amount is the sum of PAID order-item contributions.
 * Pending, failed, and cancelled items do not count.
 * Pass contribution amounts only. Guest service fees are not an input,
 * so they cannot increase a gift's raised total. A target is a goal:
 * percentOfTarget is allowed to exceed 100.
 */
export function calculateEventFunding(input: {
  gifts: FundingGift[];
  orders: FundingOrder[];
  items: FundingItem[];
}): EventFunding {
  const statusByOrder = new Map(
    input.orders.map((order) => [order.id, order.paymentStatus]),
  );
  const buckets = new Map<
    string,
    { raised: number; pending: number; contributors: Set<string> }
  >();

  for (const gift of input.gifts) {
    buckets.set(gift.id, { raised: 0, pending: 0, contributors: new Set() });
  }

  for (const item of input.items) {
    const status = statusByOrder.get(item.orderId);
    if (!status) {
      continue;
    }
    const amount = roundMoney(item.amount);
    if (!(amount > 0)) {
      continue;
    }
    const bucket = buckets.get(item.giftId) ?? {
      raised: 0,
      pending: 0,
      contributors: new Set<string>(),
    };
    if (!buckets.has(item.giftId)) {
      buckets.set(item.giftId, bucket);
    }
    if (status === "paid") {
      bucket.raised = roundMoney(bucket.raised + amount);
      bucket.contributors.add(item.orderId);
    } else if (status === "pending") {
      bucket.pending = roundMoney(bucket.pending + amount);
    }
  }

  const gifts = input.gifts.map((gift) => {
    const bucket = buckets.get(gift.id) ?? {
      raised: 0,
      pending: 0,
      contributors: new Set<string>(),
    };
    return {
      giftId: gift.id,
      raisedAmount: bucket.raised,
      pendingAmount: bucket.pending,
      contributorCount: bucket.contributors.size,
      percentOfTarget: fundingPercent(bucket.raised, gift.targetAmount),
    };
  });

  return {
    paidAmount: roundMoney(gifts.reduce((sum, gift) => sum + gift.raisedAmount, 0)),
    pendingAmount: roundMoney(
      gifts.reduce((sum, gift) => sum + gift.pendingAmount, 0),
    ),
    paidOrderCount: input.orders.filter((order) => order.paymentStatus === "paid")
      .length,
    pendingOrderCount: input.orders.filter((order) => order.paymentStatus === "pending")
      .length,
    gifts,
  };
}
