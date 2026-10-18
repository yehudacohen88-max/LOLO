export type StoredOrderWrite =
  | "update"
  | "replace"
  | "reject-auth"
  | "reject-closed";

/**
 * A paid or cancelled order stays as history. The next purchase is a new row.
 * A wrong access token or a different event never becomes a new order.
 */
export function decideStoredOrderWrite(input: {
  accessTokenMatches: boolean;
  eventMatches: boolean;
  paymentStatus: string;
}): StoredOrderWrite {
  if (!input.accessTokenMatches || !input.eventMatches) {
    return "reject-auth";
  }
  if (input.paymentStatus === "pending" || input.paymentStatus === "failed") {
    return "update";
  }
  if (input.paymentStatus === "paid" || input.paymentStatus === "cancelled") {
    return "replace";
  }
  return "reject-closed";
}
