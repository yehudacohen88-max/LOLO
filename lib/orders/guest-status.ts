import { roundMoney } from "@/lib/money";

export type GuestStatusOrder = {
  paymentStatus: string;
  paymentProvider?: string | null;
  chargedAmount?: number;
  refundedAmount?: number;
  refundStatus?: "none" | "partial" | "full" | string;
};

export function guestPaymentStatusLabel(order: GuestStatusOrder) {
  if (order.paymentStatus === "paid" && order.paymentProvider === "demo") {
    return "שולם בהדגמה";
  }
  if (order.paymentStatus === "paid") {
    return "התשלום התקבל";
  }
  if (order.paymentStatus === "failed") {
    return "התשלום לא הושלם";
  }
  if (order.paymentStatus === "cancelled") {
    return "ההזמנה בוטלה";
  }
  return "ממתינים לתשלום";
}

export function guestCanCancel(order: GuestStatusOrder) {
  return order.paymentStatus === "pending" || order.paymentStatus === "failed";
}

export function guestRefundRemaining(order: GuestStatusOrder) {
  const charged = roundMoney(order.chargedAmount ?? 0);
  const refunded = roundMoney(order.refundedAmount ?? 0);
  return roundMoney(Math.max(0, charged - refunded));
}

export function guestCanRequestRefund(order: GuestStatusOrder) {
  return (
    order.paymentStatus === "paid" &&
    order.refundStatus !== "full" &&
    guestRefundRemaining(order) > 0
  );
}

export function guestRefundLine(order: GuestStatusOrder | null) {
  if (order?.refundStatus === "full") {
    return "ההחזר נרשם. לא הועבר כסף אמיתי.";
  }
  if (order?.refundStatus === "partial") {
    return "נרשם החזר חלקי. לא הועבר כסף אמיתי.";
  }
  return "";
}

export function guestCancelLine(order: GuestStatusOrder | null) {
  if (order?.paymentStatus === "cancelled") {
    return "ההזמנה בוטלה. לא בוצע חיוב.";
  }
  return "";
}
