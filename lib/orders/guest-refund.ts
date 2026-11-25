export async function requestGuestRefund(input: {
  orderId: string;
  accessToken: string;
  amount: number;
  idempotencyKey: string;
}) {
  const response = await fetch("/api/payments/refund", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: input.orderId,
      accessToken: input.accessToken,
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
      reason: "בקשת אורח בהדגמה",
    }),
  });
  let payload: { error?: string; simulated?: boolean; status?: string; amount?: number } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(payload.error || "לא ניתן לרשום את ההחזר.");
  }
  return payload;
}
