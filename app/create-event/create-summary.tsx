"use client";

import { useEffect, useState } from "react";
import styles from "@/app/design/host-experience.module.css";
import { EmptyCover } from "@/app/e/[slug]/flagship-ui";
import { loadDraftGifts } from "@/lib/draft-gifts";
import { formatEventDate, loadEventDraft, type EventDraft } from "@/lib/event-draft";

const STEPS = [
  { step: 1, label: "האירוע" },
  { step: 2, label: "מתנות" },
  { step: 3, label: "פרטים" },
  { step: 4, label: "אורחים" },
  { step: 5, label: "תצוגה" },
] as const;

function giftLabel(draft: EventDraft, giftCount: number) {
  if (draft.giftMode === "money") {
    return "מתנה כספית";
  }
  if (giftCount === 1) {
    return "מתנה אחת";
  }
  if (giftCount > 1) {
    return `${giftCount} מתנות`;
  }
  return "עדיין לא נבחרו מתנות";
}

export default function CreateSummary({ step }: { step: number }) {
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [giftCount, setGiftCount] = useState(0);

  useEffect(() => {
    const read = () => {
      setDraft(loadEventDraft());
      setGiftCount(loadDraftGifts().length);
    };
    read();
    window.addEventListener("input", read, true);
    window.addEventListener("change", read, true);
    window.addEventListener("click", read, true);
    return () => {
      window.removeEventListener("input", read, true);
      window.removeEventListener("change", read, true);
      window.removeEventListener("click", read, true);
    };
  }, []);

  const eventName = draft?.eventName.trim() || "האירוע שלכם";
  const monogram = (draft?.hostName || draft?.eventName || "ל").trim().charAt(0) || "ל";
  const when = draft?.eventDate ? formatEventDate(draft.eventDate) : "";

  return (
    <aside className={styles.summary} aria-label="סיכום האירוע">
      <ol className={styles.rail}>
        {STEPS.map((item) => {
          const state = item.step === step ? styles.railOn : item.step < step ? styles.railDone : "";
          return (
            <li key={item.step} className={state} aria-current={item.step === step ? "step" : undefined}>
              <span>{item.step}</span>
              {item.label}
            </li>
          );
        })}
      </ol>
      <div className={styles.summaryCard}>
        <div className={styles.summaryCover}>
          {draft?.imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.imageDataUrl} alt="" />
          ) : (
            <EmptyCover monogram={monogram} />
          )}
        </div>
        <p className={styles.summaryTitle} dir="auto">
          {eventName}
        </p>
        <dl>
          <div>
            <dt>סוג</dt>
            <dd dir="auto">{draft?.eventType || "עדיין לא נבחר"}</dd>
          </div>
          <div>
            <dt>מתי</dt>
            <dd>{when || "עדיין לא נבחר תאריך"}</dd>
          </div>
          <div>
            <dt>מארח</dt>
            <dd dir="auto">{draft?.hostName.trim() || "עדיין לא הוזן"}</dd>
          </div>
          <div>
            <dt>מתנות</dt>
            <dd>{draft ? giftLabel(draft, giftCount) : "עדיין לא נבחרו מתנות"}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
