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

/**
 * Platform fallbacks. Null means the founder has not chosen a value.
 * There is no numeric stand-in: a missing store value and a null platform
 * value refuse issue.
 */
export type PlatformVoucherDefaults = {
  validityDays: number | null;
  allowPartialRedemption: boolean | null;
  allowCustomerTopup: boolean | null;
  redemptionMethod: string | null;
};

export const UNSET_PLATFORM_VOUCHER_DEFAULTS: PlatformVoucherDefaults = {
  validityDays: null,
  allowPartialRedemption: null,
  allowCustomerTopup: null,
  redemptionMethod: null,
};

export type VoucherTermField =
  | "validityDays"
  | "allowPartialRedemption"
  | "allowCustomerTopup"
  | "redemptionMethod";

export type ResolvedVoucherTerms =
  | { ok: true; terms: VoucherTerms }
  | { ok: false; missing: VoucherTermField[] };

const DAY_MS = 24 * 60 * 60 * 1000;

export function validVoucherValidityDays(
  value: number | null | undefined,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 3650
  );
}

function cleanMethod(value: string | null | undefined) {
  const method = value?.trim() ?? "";
  if (!method || method.length > 80) {
    return null;
  }
  return method;
}

/**
 * Store values win. Platform values fill only what the store left empty.
 * A field that is empty in both places is missing. Callers must refuse issue.
 */
export function resolveVoucherTerms(
  store: StoreVoucherSettings,
  platform: PlatformVoucherDefaults,
): ResolvedVoucherTerms {
  const storeValidity = validVoucherValidityDays(store.voucherValidityDays)
    ? store.voucherValidityDays
    : null;
  const platformValidity = validVoucherValidityDays(platform.validityDays)
    ? platform.validityDays
    : null;
  const validityDays = storeValidity ?? platformValidity;

  const storePartial = store.allowPartialRedemption;
  const partial =
    storePartial === true || storePartial === false
      ? storePartial
      : platform.allowPartialRedemption === true || platform.allowPartialRedemption === false
        ? platform.allowPartialRedemption
        : null;

  const storeTopup = store.allowCustomerTopup;
  const topup =
    storeTopup === true || storeTopup === false
      ? storeTopup
      : platform.allowCustomerTopup === true || platform.allowCustomerTopup === false
        ? platform.allowCustomerTopup
        : null;

  const storeMethod = cleanMethod(store.voucherRedemptionMethod);
  const platformMethod = cleanMethod(platform.redemptionMethod);
  const redemptionMethod = storeMethod ?? platformMethod;

  const missing: VoucherTermField[] = [];
  if (validityDays == null) {
    missing.push("validityDays");
  }
  if (partial == null) {
    missing.push("allowPartialRedemption");
  }
  if (topup == null) {
    missing.push("allowCustomerTopup");
  }
  if (redemptionMethod == null) {
    missing.push("redemptionMethod");
  }
  if (missing.length > 0 || validityDays == null || partial == null || topup == null || redemptionMethod == null) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    terms: {
      validityDays,
      allowPartialRedemption: partial,
      allowCustomerTopup: topup,
      redemptionMethod,
      validityIsDefault: storeValidity == null,
      partialIsDefault: storePartial == null,
      topupIsDefault: storeTopup == null,
      methodIsDefault: storeMethod == null,
    },
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

export type IssuedTermSnapshot = {
  validityDays: number;
  allowPartialRedemption: boolean;
  allowCustomerTopup: boolean;
  redemptionMethod: string;
  validityIsDefault: boolean;
  partialIsDefault: boolean;
  topupIsDefault: boolean;
  methodIsDefault: boolean;
  issuedAt: string;
  expiresAt: string;
};

/** Copy the terms that will be stored on the voucher. Later setting changes do not touch it. */
export function snapshotIssuedTerms(terms: VoucherTerms, issuedAt: Date): IssuedTermSnapshot {
  return {
    validityDays: terms.validityDays,
    allowPartialRedemption: terms.allowPartialRedemption,
    allowCustomerTopup: terms.allowCustomerTopup,
    redemptionMethod: terms.redemptionMethod,
    validityIsDefault: terms.validityIsDefault,
    partialIsDefault: terms.partialIsDefault,
    topupIsDefault: terms.topupIsDefault,
    methodIsDefault: terms.methodIsDefault,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + terms.validityDays * DAY_MS).toISOString(),
  };
}

/** Days already stored on the voucher. Never substitutes a platform default. */
export function validityDaysFromSnapshot(input: {
  validityDays?: number | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
}) {
  if (validVoucherValidityDays(input.validityDays)) {
    return input.validityDays;
  }
  const issued = input.issuedAt ? Date.parse(input.issuedAt) : Number.NaN;
  const expires = input.expiresAt ? Date.parse(input.expiresAt) : Number.NaN;
  if (Number.isFinite(issued) && Number.isFinite(expires) && expires > issued) {
    return Math.max(1, Math.round((expires - issued) / DAY_MS));
  }
  return 0;
}
