/** Visible markers for unapproved legal drafts. Do not reword these prefixes. */

export const BUSINESS_DECISION = "⚠️ דורש החלטה עסקית";
export const LEGAL_REVIEW = "⚠️ דורש אימות משפטי";

export function pending(label: string) {
  return `[להשלמה: ${label}]`;
}

export function businessDecision(text: string) {
  return `${BUSINESS_DECISION}: ${text}`;
}

export function legalReview(text: string) {
  return `${LEGAL_REVIEW}: ${text}`;
}
