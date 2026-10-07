import { roundMoney } from "@/lib/money";
import type { GuestFeeSettings } from "@/lib/payments/fee";

const MAX_FIXED_FEE = 1_000_000;

export function parseGuestFeeSettings(body: unknown): GuestFeeSettings {
  if (!body || typeof body !== "object") {
    throw new Error("נתונים לא תקינים.");
  }

  const record = body as Record<string, unknown>;
  if (typeof record.guestFeeEnabled !== "boolean") {
    throw new Error("נתונים לא תקינים.");
  }

  const percent = typeof record.guestFeePercent === "number"
    ? record.guestFeePercent
    : Number(record.guestFeePercent);
  const fixed = typeof record.guestFeeFixed === "number"
    ? record.guestFeeFixed
    : Number(record.guestFeeFixed);

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error("אחוז העמלה חייב להיות בין 0 ל־100.");
  }
  if (!Number.isFinite(fixed) || fixed < 0 || fixed > MAX_FIXED_FEE) {
    throw new Error("סכום העמלה הקבוע אינו תקין.");
  }

  return {
    enabled: record.guestFeeEnabled,
    percent: roundMoney(percent),
    fixedAmount: roundMoney(fixed),
  };
}
