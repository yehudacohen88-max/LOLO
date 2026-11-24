export const PILOT_FEEDBACK_ROLES = ["host", "guest", "store"] as const;
export const PILOT_FEEDBACK_DEVICES = ["phone", "desktop"] as const;
export const PILOT_FEEDBACK_COMPLETION = ["yes", "partial", "no"] as const;
export const PILOT_FEEDBACK_USE = ["yes", "maybe", "no"] as const;

export const PILOT_FEEDBACK_CLOSED = "טופס המשוב עדיין לא זמין.";
export const PILOT_FEEDBACK_INVALID = "הטופס אינו תקין.";
export const PILOT_FEEDBACK_NOTES_LIMIT = 1000;

export type PilotFeedbackRole = (typeof PILOT_FEEDBACK_ROLES)[number];
export type PilotFeedbackDevice = (typeof PILOT_FEEDBACK_DEVICES)[number];
export type PilotFeedbackCompletion = (typeof PILOT_FEEDBACK_COMPLETION)[number];
export type PilotFeedbackUse = (typeof PILOT_FEEDBACK_USE)[number];

export type PilotFeedbackInput = {
  role: PilotFeedbackRole;
  device: PilotFeedbackDevice;
  completed: PilotFeedbackCompletion;
  clarity: number;
  demoPaymentClear: boolean;
  wouldUse: PilotFeedbackUse;
  notes: string;
};

function asRecord(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(PILOT_FEEDBACK_INVALID);
  }
  return body as Record<string, unknown>;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], message: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(message);
  }
  return value as T;
}

export function parsePilotFeedback(body: unknown): PilotFeedbackInput {
  const record = asRecord(body);
  const clarity = record.clarity;
  if (typeof clarity !== "number" || !Number.isInteger(clarity) || clarity < 1 || clarity > 5) {
    throw new Error("בחרו עד כמה היה ברור, מ־1 עד 5.");
  }
  if (typeof record.demoPaymentClear !== "boolean") {
    throw new Error("סמנו אם היה ברור שלא נגבה כסף.");
  }

  const notes = typeof record.notes === "string" ? record.notes.trim() : "";
  if (notes.length > PILOT_FEEDBACK_NOTES_LIMIT) {
    throw new Error("ההערה ארוכה מדי.");
  }

  return {
    role: oneOf(record.role, PILOT_FEEDBACK_ROLES, "בחרו אם אתם מארח, אורח או חנות."),
    device: oneOf(record.device, PILOT_FEEDBACK_DEVICES, "בחרו טלפון או מחשב."),
    completed: oneOf(
      record.completed,
      PILOT_FEEDBACK_COMPLETION,
      "סמנו אם סיימתם את המסלול.",
    ),
    clarity,
    demoPaymentClear: record.demoPaymentClear,
    wouldUse: oneOf(record.wouldUse, PILOT_FEEDBACK_USE, "סמנו אם הייתם משתמשים בזה באירוע אמיתי."),
    notes,
  };
}
