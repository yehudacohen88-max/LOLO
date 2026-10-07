export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type OrderItemInput = {
  giftId: string;
  amount: number;
};

export type UpsertOrderInput = {
  slug: string;
  orderId?: string;
  accessToken?: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  wantsConfirmation: boolean;
  greetingText: string;
  items: OrderItemInput[];
};

export type StoredOrderItem = {
  giftId: string;
  giftName: string;
  amount: number;
};

export type StoredOrder = {
  id: string;
  eventId: string;
  eventSlug: string;
  guestName: string;
  /** Gift contribution. Same value as contributionAmount. */
  totalAmount: number;
  contributionAmount: number;
  feeAmount: number;
  chargedAmount: number;
  paymentStatus: PaymentStatus;
  paymentProvider: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  accessToken: string;
  items: StoredOrderItem[];
};
