import { isSimulatedPayment } from "@/lib/vouchers/demo-funding";
import { DEMO_PROVIDER_NAME } from "./demo-provider-name";
import {
  REFUND_DEMO_NO_NETWORK,
  REFUND_DEMO_ONLY,
} from "./messages";
import { decideRefund, type RefundActor, type RefundPolicy, type RefundPolicySnapshot } from "./refund-policy";

export type DemoRefundRecord = {
  orderId: string;
  amount: number;
  provider: typeof DEMO_PROVIDER_NAME;
  providerReference: string;
  paymentReference: string;
  idempotencyKey: string;
  simulated: true;
  status: "recorded";
  reason: string;
  approver: RefundPolicySnapshot["approver"];
  policyWindowDays: number;
  policyAllowPartial: boolean;
  policyBlocksIssuedVoucher: boolean;
  externalUrl: null;
  replayed: boolean;
};

export type DemoRefundInput = {
  orderId: string;
  actor: RefundActor;
  amount: number;
  idempotencyKey: string;
  reason: string;
  now: string;
  policy: RefundPolicy;
  paymentStatus: string;
  paymentProvider: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  chargedAmount: number;
  alreadyRefunded: number;
  issuedVoucher: boolean;
  existing: DemoRefundRecord | null;
  createReference: () => string;
  /**
   * Present only when a test injects a transport. Demo refunds reject it
   * without calling it. Production does not pass this.
   */
  outbound?: (url: string) => Promise<unknown>;
};

export function performDemoRefund(input: DemoRefundInput): DemoRefundRecord {
  if (input.outbound) {
    throw new Error(REFUND_DEMO_NO_NETWORK);
  }
  if (input.existing) {
    return { ...input.existing, replayed: true };
  }

  const simulated = isSimulatedPayment({
    amount: input.chargedAmount,
    paymentStatus: input.paymentStatus,
    paymentProvider: input.paymentProvider,
    paymentReference: input.paymentReference,
  });
  if (!simulated || (input.paymentProvider ?? "").trim().toLowerCase() !== DEMO_PROVIDER_NAME) {
    throw new Error(REFUND_DEMO_ONLY);
  }
  const paymentReference = (input.paymentReference ?? "").trim().toLowerCase();
  if (!paymentReference.startsWith("demo-")) {
    throw new Error(REFUND_DEMO_ONLY);
  }

  const decision = decideRefund({
    policy: input.policy,
    actor: input.actor,
    paidAt: input.paidAt,
    now: input.now,
    chargedAmount: input.chargedAmount,
    alreadyRefunded: input.alreadyRefunded,
    requestedAmount: input.amount,
    issuedVoucher: input.issuedVoucher,
    paymentStatus: input.paymentStatus,
  });
  if (!decision.ok) {
    throw new Error(decision.message);
  }

  return {
    orderId: input.orderId,
    amount: decision.amount,
    provider: DEMO_PROVIDER_NAME,
    providerReference: input.createReference(),
    paymentReference,
    idempotencyKey: input.idempotencyKey,
    simulated: true,
    status: "recorded",
    reason: input.reason,
    approver: decision.snapshot.approver,
    policyWindowDays: decision.snapshot.windowDays,
    policyAllowPartial: decision.snapshot.allowPartial,
    policyBlocksIssuedVoucher: decision.snapshot.blocksIssuedVoucher,
    externalUrl: null,
    replayed: false,
  };
}
