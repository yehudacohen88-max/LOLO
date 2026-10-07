import type { SettlementMethod } from "@/lib/admin/store-fields";

export const SETTLEMENT_STATUSES = ["PENDING", "PAID", "CANCELLED"] as const;

export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export function asSettlementStatus(value: string): SettlementStatus {
  if (value === "PAID" || value === "CANCELLED" || value === "PENDING") {
    return value;
  }
  return "PENDING";
}

export type SettlementListItem = {
  id: string;
  storeId: string;
  storeName: string;
  status: SettlementStatus;
  grossAmount: number;
  commissionAmount: number;
  payableAmount: number;
  dueAt: string;
  createdAt: string;
  paidAt: string | null;
  paymentReference: string | null;
  paymentMethod: SettlementMethod | null;
  settlementMethod: SettlementMethod | null;
  overdue: boolean;
};

export type SettlementLineView = {
  id: string;
  redemptionId: string;
  voucherId: string;
  voucherCode: string;
  giftTitle: string;
  eventTitle: string;
  grossAmount: number;
  commissionPercent: number;
  commissionSpecified: boolean;
  commissionAmount: number;
  payableAmount: number;
  paymentTermsDays: number;
  termsSpecified: boolean;
  redeemedAt: string;
  dueAt: string;
};

export type SettlementDetail = SettlementListItem & {
  cancelledAt: string | null;
  lines: SettlementLineView[];
};

export type SettlementCommandResult = {
  id: string;
  status: SettlementStatus;
  idempotent: boolean;
};

export type StoreBalance = {
  storeId: string;
  storeName: string;
  unsettledCount: number;
  unsettledGross: number;
  unsettledCommission: number;
  unsettledPayable: number;
  pendingCount: number;
  pendingPayable: number;
  paidCount: number;
  paidPayable: number;
};
