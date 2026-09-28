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
  totalAmount: number;
  paymentStatus: PaymentStatus;
  accessToken: string;
  items: StoredOrderItem[];
};
