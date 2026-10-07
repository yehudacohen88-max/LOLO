export const VOUCHER_TERM_DEFAULTS = {
  validityDays: 365,
  allowPartialRedemption: false,
  allowCustomerTopup: false,
  redemptionMethod: "הצגת השובר בחנות",
} as const;

export type VoucherTerms = {
  validityDays: number;
  allowPartialRedemption: boolean;
  allowCustomerTopup: boolean;
  redemptionMethod: string;
  validityIsDefault: boolean;
  partialIsDefault: boolean;
  topupIsDefault: boolean;
  methodIsDefault: boolean;
};

export type StoreVoucherSettings = {
  voucherValidityDays: number | null;
  allowPartialRedemption: boolean | null;
  allowCustomerTopup: boolean | null;
  voucherRedemptionMethod: string | null;
};

export function resolveVoucherTerms(store: StoreVoucherSettings): VoucherTerms {
  const method = store.voucherRedemptionMethod?.trim() ?? "";
  const validity = store.voucherValidityDays;
  const validityIsDefault = !(
    typeof validity === "number" &&
    Number.isInteger(validity) &&
    validity >= 1 &&
    validity <= 3650
  );

  return {
    validityDays: validityIsDefault ? VOUCHER_TERM_DEFAULTS.validityDays : validity,
    allowPartialRedemption:
      store.allowPartialRedemption ?? VOUCHER_TERM_DEFAULTS.allowPartialRedemption,
    allowCustomerTopup:
      store.allowCustomerTopup ?? VOUCHER_TERM_DEFAULTS.allowCustomerTopup,
    redemptionMethod: method || VOUCHER_TERM_DEFAULTS.redemptionMethod,
    validityIsDefault,
    partialIsDefault: store.allowPartialRedemption == null,
    topupIsDefault: store.allowCustomerTopup == null,
    methodIsDefault: method.length === 0,
  };
}

export function termsMatch(
  confirmed: Pick<
    VoucherTerms,
    | "validityDays"
    | "allowPartialRedemption"
    | "allowCustomerTopup"
    | "redemptionMethod"
  >,
  current: VoucherTerms,
) {
  return (
    confirmed.validityDays === current.validityDays &&
    confirmed.allowPartialRedemption === current.allowPartialRedemption &&
    confirmed.allowCustomerTopup === current.allowCustomerTopup &&
    confirmed.redemptionMethod === current.redemptionMethod
  );
}
