import type { StoredOrder } from "@/lib/orders/types";

/**
 * Isolated payment-provider boundary.
 * Next step: create a checkout session and redirect the guest.
 * Do not mark the order as paid here. Paid status belongs to a webhook.
 */
export async function startGuestPayment(order: StoredOrder) {
  return {
    provider: "none" as const,
    orderId: order.id,
    amount: order.totalAmount,
    status: "pending" as const,
  };
}
