import { LEGAL_REVIEW } from "@/lib/legal/markers";

export const LEGAL_PRIVACY_PATH = "/legal/privacy";

export type LegalNoticeKind = "guest" | "host";

export type LegalNotice = {
  id: LegalNoticeKind;
  text: string;
  href: string;
  linkLabel: string;
  marker: string | null;
};

const GUEST_NOTICE: LegalNotice = {
  id: "guest",
  text: "השם, הטלפון והאימייל נשמרים עם ההשתתפות ומוצגים למארח. במסלול ההדגמה אין חיוב, ואין שליחת אימייל או מסרון.",
  href: LEGAL_PRIVACY_PATH,
  linkLabel: "מדיניות הפרטיות (טיוטה)",
  marker: null,
};

const HOST_NOTICE: LegalNotice = {
  id: "host",
  text: "שם ומספר הטלפון של המוזמן נשמרים ברשימת ההזמנה. אפשר לפתוח מהם קישור אישי. לפני השמירה ודאו שיש בידכם הסכמה של אותו אדם, או בסיס חוקי אחר, למסור את הפרטים. LOLO אינה שולחת את ההזמנה בעצמה.",
  href: LEGAL_PRIVACY_PATH,
  linkLabel: "מדיניות הפרטיות (טיוטה)",
  marker: LEGAL_REVIEW,
};

const NOTICES: Record<LegalNoticeKind, LegalNotice> = {
  guest: GUEST_NOTICE,
  host: HOST_NOTICE,
};

/** Flag off returns null so the form renders nothing. */
export function legalCollectionNotice(
  kind: LegalNoticeKind,
  enabled: boolean,
): LegalNotice | null {
  if (!enabled) {
    return null;
  }
  return NOTICES[kind];
}

export function legalNoticeMarkdown() {
  const lines = [
    "# הודעות איסוף (טיוטה)",
    "",
    "הטקסטים האלה מוצגים בטפסים רק כש־`LEGAL_DRAFTS_ENABLED` מופעל. כשהדגל כבוי הם לא מרונדרים.",
    "",
    "## אורח",
    "",
    "מוצג בטופס פרטי האורח, ליד השם, הטלפון והאימייל.",
    "",
    GUEST_NOTICE.text,
    "",
    `[${GUEST_NOTICE.linkLabel}](${GUEST_NOTICE.href})`,
    "",
    "## מארח",
    "",
    "מוצג ביצירת האירוע וברשימת המוזמנים של המארח, לפני הזנת שם וטלפון.",
    "",
    HOST_NOTICE.text,
    "",
    HOST_NOTICE.marker ?? "",
    "",
    `[${HOST_NOTICE.linkLabel}](${HOST_NOTICE.href})`,
    "",
  ];
  return lines.join("\n");
}
