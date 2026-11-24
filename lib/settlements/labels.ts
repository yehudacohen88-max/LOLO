export function settlementBatchLabel(status: string) {
  if (status === "PAID") {
    return "שולמה";
  }
  if (status === "CANCELLED") {
    return "בוטלה";
  }
  return "ממתינה לתשלום";
}

export function lineCommissionLabel(percent: number, specified: boolean) {
  const text = percent.toLocaleString("he-IL", {
    maximumFractionDigits: 2,
  });
  if (!specified) {
    return `ברירת מחדל (${text}%)`;
  }
  return `${text}%`;
}

export function lineTermsLabel(days: number, specified: boolean) {
  const base = days === 0 ? "מיידי" : `${days.toLocaleString("he-IL")} יום`;
  if (!specified) {
    return `ברירת מחדל (${base})`;
  }
  return base;
}

export const DEMO_REDEMPTION_LABEL = "הדגמה — לא לתשלום";
