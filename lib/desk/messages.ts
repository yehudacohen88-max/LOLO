export const DESK_FORBIDDEN = "אין הרשאה.";

export const AUDIT_UNAVAILABLE = "יומן הפעולות עדיין לא זמין.";

export const PAYMENTS_LEDGER_UNAVAILABLE = "רישום התשלומים עדיין לא הופעל.";

export const NOTES_UNAVAILABLE = "הערות התמיכה עדיין לא הופעלו.";

export const NOTIFICATIONS_UNAVAILABLE = "יומן ההודעות עדיין לא זמין.";

export const DEMO_CLASS_UNAVAILABLE =
  "סיווג ההדגמה עדיין לא זמין, ולכן לא מציגים סכום לתשלום.";

export const STORE_LOCKED_FIELDS =
  "אי אפשר לעדכן עמלה, תנאי תשלום או תנאי שובר מכאן.";

export class DeskError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DeskError";
    this.status = status;
  }
}
