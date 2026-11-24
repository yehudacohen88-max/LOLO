import { roundMoney } from "@/lib/money";
import { isAllowListedRealProvider, REAL_PROVIDER_ALLOWLIST } from "@/lib/payments/allowlist";

/** Exact label for a voucher that must not be treated as money. */
export const DEMO_VOUCHER_LABEL = "שובר הדגמה – ללא ערך כספי";

/** Host-facing caption. Demo totals are a simulation, not money received. */
export const DEMO_MONEY_LABEL = "הדגמה — לא כסף שהתקבל";

export type PaidSlice = {
  amount: number;
  paymentStatus: string;
  paymentProvider?: string | null;
  paymentReference?: string | null;
};

export type VoucherPoolSlice = {
  amount: number;
  status: string;
  /** Null when the demo_only column is not available yet. */
  demoOnly: boolean | null;
};

/**
 * Real money is a paid order whose provider is on the real-provider allow-list
 * and whose reference is not a demo reference. Empty, "demo", "none", a demo-
 * reference, and any name that is not allow-listed are simulated.
 * One classifier for payments, vouchers, and settlement. A new PSP name is
 * allow-listed; it is not inferred from "anything except demo".
 */
export function isSimulatedPayment(
  slice: PaidSlice,
  allowlist: readonly string[] = REAL_PROVIDER_ALLOWLIST,
) {
  if (slice.paymentStatus !== "paid") {
    return false;
  }
  const provider = (slice.paymentProvider ?? "").trim().toLowerCase();
  const reference = (slice.paymentReference ?? "").trim().toLowerCase();
  if (!provider || provider === "demo" || provider === "none") {
    return true;
  }
  if (reference.startsWith("demo-")) {
    return true;
  }
  return !isAllowListedRealProvider(provider, allowlist);
}

export function isRealMoneyPayment(slice: PaidSlice, allowlist?: readonly string[]) {
  if (slice.paymentStatus !== "paid") {
    return false;
  }
  const amount = roundMoney(slice.amount);
  if (!(amount > 0)) {
    return false;
  }
  return !isSimulatedPayment(slice, allowlist);
}

export function sumPaidPools(slices: PaidSlice[], allowlist?: readonly string[]) {
  let realPaid = 0;
  let simulatedPaid = 0;
  for (const slice of slices) {
    const amount = roundMoney(slice.amount);
    if (!(amount > 0) || slice.paymentStatus !== "paid") {
      continue;
    }
    if (isSimulatedPayment(slice, allowlist)) {
      simulatedPaid = roundMoney(simulatedPaid + amount);
    } else {
      realPaid = roundMoney(realPaid + amount);
    }
  }
  return { realPaid, simulatedPaid };
}

function activeAmount(vouchers: VoucherPoolSlice[], include: (voucher: VoucherPoolSlice) => boolean) {
  return roundMoney(
    vouchers.reduce((sum, voucher) => {
      if (voucher.status === "CANCELLED" || !include(voucher)) {
        return sum;
      }
      return sum + roundMoney(voucher.amount);
    }, 0),
  );
}

/**
 * Vouchers already issued without a demo flag still consume the simulated
 * pool once real money is used up, so the same demo payment cannot be issued twice.
 */
export function allocateVoucherPools(input: {
  realPaid: number;
  simulatedPaid: number;
  vouchers: VoucherPoolSlice[];
}) {
  const realPaid = roundMoney(Math.max(0, input.realPaid));
  const simulatedPaid = roundMoney(Math.max(0, input.simulatedPaid));
  const explicitDemo = activeAmount(input.vouchers, (voucher) => voucher.demoOnly === true);
  const monetaryCommitted = activeAmount(input.vouchers, (voucher) => voucher.demoOnly !== true);
  const uncovered = roundMoney(Math.max(0, monetaryCommitted - realPaid));
  return {
    monetaryAvailable: roundMoney(Math.max(0, realPaid - monetaryCommitted)),
    demoAvailable: roundMoney(Math.max(0, simulatedPaid - explicitDemo - uncovered)),
    monetaryCommitted,
    demoCommitted: explicitDemo,
  };
}

export type IssueFundingPlan =
  | { ok: true; kind: "monetary" | "demo"; amount: number }
  | { ok: false; reason: "none" | "changed" | "demo-blocked" };

/**
 * Monetary issue uses only real-provider payments.
 * A demo voucher is issued only when the database guard is in place, so the
 * old redeem function cannot turn it into spendable money.
 * Without that guard, demo funding fails closed and is not issued.
 */
export function planFundedVoucherIssue(input: {
  realPaid: number;
  simulatedPaid: number;
  vouchers: VoucherPoolSlice[];
  expectedAmount?: number | null;
  guardReady: boolean;
  fundingKnown: boolean;
}): IssueFundingPlan {
  if (!input.fundingKnown) {
    return { ok: false, reason: "demo-blocked" };
  }
  const pools = allocateVoucherPools(input);
  if (pools.monetaryAvailable > 0) {
    if (!input.guardReady && input.simulatedPaid > 0) {
      return { ok: false, reason: "demo-blocked" };
    }
    if (
      input.expectedAmount != null &&
      roundMoney(input.expectedAmount) !== pools.monetaryAvailable
    ) {
      return { ok: false, reason: "changed" };
    }
    return { ok: true, kind: "monetary", amount: pools.monetaryAvailable };
  }
  if (pools.demoAvailable > 0) {
    if (!input.guardReady) {
      return { ok: false, reason: "demo-blocked" };
    }
    if (
      input.expectedAmount != null &&
      roundMoney(input.expectedAmount) !== pools.demoAvailable
    ) {
      return { ok: false, reason: "changed" };
    }
    return { ok: true, kind: "demo", amount: pools.demoAvailable };
  }
  return { ok: false, reason: "none" };
}

export function planFundedRedeem(input: {
  demoOnly: boolean | null;
  voucherAmount: number;
  realPaid: number;
  simulatedPaid: number;
  monetaryCommitted: number;
  fundingKnown: boolean;
}): { ok: true } | { ok: false; reason: "demo" } {
  if (!input.fundingKnown) {
    return { ok: false, reason: "demo" };
  }
  if (input.demoOnly === true) {
    return { ok: false, reason: "demo" };
  }
  if (input.demoOnly == null && input.simulatedPaid > 0) {
    return { ok: false, reason: "demo" };
  }
  const realPaid = roundMoney(input.realPaid);
  if (roundMoney(input.monetaryCommitted) - realPaid > 0) {
    return { ok: false, reason: "demo" };
  }
  if (roundMoney(input.voucherAmount) - realPaid > 0) {
    return { ok: false, reason: "demo" };
  }
  return { ok: true };
}

export function voucherShowsAsDemo(input: {
  demoOnly: boolean | null;
  voucherAmount: number;
  realPaid: number;
  simulatedPaid: number;
  monetaryCommitted: number;
  fundingKnown: boolean;
}) {
  if (!input.fundingKnown) {
    return true;
  }
  if (input.demoOnly === true) {
    return true;
  }
  return !planFundedRedeem(input).ok;
}

export type HostMoneyTone = "real" | "simulated" | "mixed";

export function hostMoneyPresentation(realPaid: number, simulatedPaid: number) {
  const real = roundMoney(realPaid);
  const simulated = roundMoney(simulatedPaid);
  if (simulated > 0 && real <= 0) {
    return { tone: "simulated" as const, caption: DEMO_MONEY_LABEL };
  }
  if (simulated > 0 && real > 0) {
    return { tone: "mixed" as const, caption: DEMO_MONEY_LABEL };
  }
  return { tone: "real" as const, caption: "" };
}
