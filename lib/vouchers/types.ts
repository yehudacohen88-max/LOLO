import type { VoucherStatus } from "@/lib/vouchers/status";
import type { VoucherTerms } from "@/lib/vouchers/terms";

export type VoucherStoreOption = {
  id: string;
  name: string;
  logoUrl: string | null;
  terms: VoucherTerms;
};

export type HostGiftVoucher = {
  id: string;
  amount: number;
  remainingAmount: number;
  status: VoucherStatus;
  expiresAt: string;
  storeName: string;
};

export type VoucherListItem = {
  id: string;
  code: string;
  storeId: string;
  storeName: string;
  giftTitle: string;
  eventTitle: string;
  amount: number;
  remainingAmount: number;
  status: VoucherStatus;
  issuedAt: string;
  expiresAt: string;
};

export type VoucherRedemptionView = {
  id: string;
  amount: number;
  redeemedAt: string;
  channel: string;
  reference: string | null;
};

export type AdminRedemption = {
  id: string;
  voucherId: string;
  voucherCode: string;
  storeId: string;
  storeName: string;
  giftTitle: string;
  amount: number;
  redeemedAt: string;
  channel: string;
  reference: string | null;
  commissionPercent: number | null;
  paymentTermsDays: number | null;
  settlementStatus: string;
};

export type VoucherCardModel = {
  id: string;
  storeName: string;
  storeLogoUrl: string | null;
  giftTitle: string;
  eventTitle: string;
  amount: number;
  remainingAmount: number;
  code: string;
  qrSvg: string;
  issuedAt: string;
  expiresAt: string;
  status: VoucherStatus;
  terms: VoucherTerms;
  redemptions: VoucherRedemptionView[];
  shareUrl: string;
};

export type StoreVoucherLookup = {
  code: string;
  giftTitle: string;
  eventTitle: string;
  storeName: string;
  amount: number;
  remainingAmount: number;
  status: VoucherStatus;
  expiresAt: string;
  terms: VoucherTerms;
  canRedeem: boolean;
  blockedReason: string | null;
};

export type AdminVoucherDetail = {
  card: VoucherCardModel;
  eventId: string;
  storeId: string;
  canCancel: boolean;
  canRedeem: boolean;
};

export type StoreAccessStatus = {
  configured: boolean;
  updatedAt: string | null;
};
