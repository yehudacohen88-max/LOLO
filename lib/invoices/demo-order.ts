/**
 * Demo money matches the payment rule already used by checkout:
 * an empty provider, the name "demo", or a reference that starts with "demo-".
 * A new live provider name is not demo. It has to be allow-listed later.
 */
export function isDemoMoney(order: {
  paymentProvider: string | null;
  paymentReference: string | null;
}) {
  const provider = (order.paymentProvider ?? "").trim().toLowerCase();
  const reference = (order.paymentReference ?? "").trim().toLowerCase();
  if (provider === "" || provider === "demo") {
    return true;
  }
  return reference.startsWith("demo-");
}
