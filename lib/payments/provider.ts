import "server-only";
import type { PaymentProvider } from "./contract";
import { demoPaymentProvider, nonePaymentProvider } from "./demo-provider";
import { createLiveProviderStub } from "./live-stub";
import { resolveProviderKind } from "./selection";

/**
 * Server-side payment boundary.
 *
 * PAYMENT_PROVIDER defaults to demo. Demo never moves real money.
 * "none" keeps orders pending. Any other name returns a stub that fails
 * closed: there is no live PSP implementation in this package.
 * A future provider must be added to REAL_PROVIDER_ALLOWLIST and replace
 * the stub. Until then its name is not real money and its methods throw.
 */

const loggedLive = new Set<string>();

export function getPaymentProvider(): PaymentProvider {
  const kind = resolveProviderKind(process.env.PAYMENT_PROVIDER);
  if (kind === "demo") {
    return demoPaymentProvider;
  }
  if (kind === "none") {
    return nonePaymentProvider;
  }

  const name = process.env.PAYMENT_PROVIDER?.trim().toLowerCase() || "unconfigured";
  if (!loggedLive.has(name)) {
    loggedLive.add(name);
    console.error(
      "[LOLO] PAYMENT_PROVIDER is set, but that live provider is not implemented yet.",
      { provider: name },
    );
  }
  return createLiveProviderStub(name);
}

export function getDemoPaymentProvider() {
  const provider = getPaymentProvider();
  if (!provider.isDemo) {
    return null;
  }
  return provider;
}
