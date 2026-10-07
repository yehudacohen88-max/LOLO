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
  if (!specified) {
    return "לא הוגדרה (0%)";
  }
  const text = percent.toLocaleString("he-IL", {
    maximumFractionDigits: 2,
  });
  return `${text}%`;
}

export function lineTermsLabel(days: number, specified: boolean) {
  if (!specified) {
    return "לא הוגדרו (מיידי)";
  }
  if (days === 0) {
    return "מיידי";
  }
  return `${days.toLocaleString("he-IL")} יום`;
}
