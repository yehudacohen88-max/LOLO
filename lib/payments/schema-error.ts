import "server-only";
import {
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";

const logged = new Set<string>();

export function isMissingCheckoutSchema(error: { code?: string; message?: string }) {
  const code = error.code ?? "";
  if (code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205") {
    return true;
  }

  const message = (error.message ?? "").toLowerCase();
  const mentionsCheckout =
    message.includes("platform_settings") ||
    message.includes("fee_amount") ||
    message.includes("charged_amount") ||
    message.includes("payment_provider") ||
    message.includes("payment_reference") ||
    message.includes("paid_at");

  return (
    mentionsCheckout &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("could not find"))
  );
}

export function rethrowIfCheckoutSchema(error: { code?: string; message?: string } | null) {
  if (!error || !isMissingCheckoutSchema(error)) {
    return;
  }

  const key = `${error.code ?? ""}:${error.message ?? ""}`;
  if (!logged.has(key)) {
    logged.add(key);
    console.error(
      "[LOLO] Demo checkout schema is missing. Run supabase/demo-checkout.sql in the Supabase SQL editor.",
      { code: error.code, message: error.message },
    );
  }

  const unavailable = new Error(SERVICE_UNAVAILABLE_MESSAGE);
  unavailable.name = "ServiceUnavailableError";
  throw unavailable;
}
