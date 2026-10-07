import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  GUEST_FEE_OFF,
  type GuestFeeSettings,
} from "@/lib/payments/fee";
import { rethrowIfCheckoutSchema } from "@/lib/payments/schema-error";
import {
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";

type SettingsRow = {
  guest_fee_enabled: boolean | null;
  guest_fee_percent: number | string | null;
  guest_fee_fixed: number | string | null;
};

function toSettings(row: SettingsRow | null): GuestFeeSettings {
  if (!row) {
    return GUEST_FEE_OFF;
  }

  const percent = Number(row.guest_fee_percent);
  const fixed = Number(row.guest_fee_fixed);
  return {
    enabled: row.guest_fee_enabled === true,
    percent: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0,
    fixedAmount: Number.isFinite(fixed) ? Math.max(0, fixed) : 0,
  };
}

export async function getGuestFeeSettings(): Promise<GuestFeeSettings> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("guest_fee_enabled, guest_fee_percent, guest_fee_fixed")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    rethrowIfCheckoutSchema(error);
    console.error("[LOLO] platform settings read failed", {
      code: error.code,
      message: error.message,
    });
    const unavailable = new Error(SERVICE_UNAVAILABLE_MESSAGE);
    unavailable.name = "ServiceUnavailableError";
    throw unavailable;
  }

  return toSettings((data ?? null) as SettingsRow | null);
}

export async function saveGuestFeeSettings(settings: GuestFeeSettings) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("platform_settings").upsert({
    id: "default",
    guest_fee_enabled: settings.enabled,
    guest_fee_percent: settings.percent,
    guest_fee_fixed: settings.fixedAmount,
  });

  if (error) {
    rethrowIfCheckoutSchema(error);
    console.error("[LOLO] platform settings write failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error("שמירת ההגדרות נכשלה.");
  }
}
