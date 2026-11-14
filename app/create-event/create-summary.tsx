"use client";

import { useEffect, useState } from "react";
import ResolvedPhoto from "@/app/design/resolved-photo";
import styles from "@/app/design/bold-create.module.css";
import { loadDraftGifts } from "@/lib/draft-gifts";
import { formatEventDate, loadEventDraft, type EventDraft } from "@/lib/event-draft";
import { resolveEventCover } from "@/lib/image-library";

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

export default function CreateSummary({ compact = false }: { compact?: boolean }) {
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
    window.addEventListener("lolo-draft", read);
    return () => {
      window.removeEventListener("input", read, true);
      window.removeEventListener("change", read, true);
      window.removeEventListener("click", read, true);
      window.removeEventListener("lolo-draft", read);
    };
  }, []);

  const eventName = draft?.eventName.trim() || "האירוע שלכם";
  const when = draft?.eventDate ? formatEventDate(draft.eventDate) : "";
  const cover = resolveEventCover({
    hostImageUrl: draft?.imageDataUrl,
    eventType: draft?.eventType,
    title: draft?.eventName,
    alt: draft?.imageDataUrl ? "" : undefined,
  });
  const libraryCover = resolveEventCover({
    hostImageUrl: "",
    eventType: draft?.eventType,
    title: draft?.eventName,
  });

  return (
    <div className={compact ? styles.compactCard : styles.summaryCard}>
      <ResolvedPhoto
        visual={cover}
        backup={libraryCover}
        compact={compact}
        fallback={<div className={styles.photoFallback}>תמונת האירוע</div>}
      />
      <div className={compact ? styles.compactCopy : undefined}>
      <p className={styles.summaryTitle} dir="auto">
        {eventName}
      </p>
      {compact ? <p className={styles.compactMeta}>{draft?.eventType || "עדיין לא נבחר סוג"}</p> : null}
      {compact ? null : (
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
      )}
      </div>
    </div>
  );
}
