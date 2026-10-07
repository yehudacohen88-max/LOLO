export type PaymentOutcome = "success" | "failure";

export type CheckoutQuote = {
  contributionAmount: number;
  feeAmount: number;
  chargedAmount: number;
  feeEnabled: boolean;
  provider: string;
  isDemo: boolean;
};

export type StartPaymentResponse = {
  provider: string;
  isDemo: boolean;
  orderId: string;
  status: "ready" | "paid" | "unavailable";
  checkoutUrl?: string;
  contributionAmount: number;
  feeAmount: number;
  chargedAmount: number;
};
