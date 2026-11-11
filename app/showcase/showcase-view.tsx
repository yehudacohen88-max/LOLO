"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import GuestEventView from "../e/[slug]/guest-event-view";
import {
  isShowcaseScene,
  SHOWCASE_LABELS,
  SHOWCASE_PREVIEWS,
  SHOWCASE_SCENES,
  type ShowcaseScene,
} from "@/lib/showcase-data";

export default function ShowcaseView() {
  const params = useSearchParams();
  const requested = params.get("scene");
  const [scene, setScene] = useState<ShowcaseScene>(
    isShowcaseScene(requested) ? requested : "birthday",
  );
  const [joined, setJoined] = useState(false);
  const preview = SHOWCASE_PREVIEWS[scene];

  return (
    <>
      <section className="lo-showcase-bar" aria-label="הדגמה">
        <p>הדגמה — נתונים לדוגמה בלבד. לא נוצרת הזמנה ולא נשמר תשלום.</p>
        <div className="lo-chip-row" role="group" aria-label="סצנות הדגמה">
          {SHOWCASE_SCENES.map((id) => (
            <button
              key={id}
              type="button"
              className="lo-chip"
              aria-pressed={scene === id}
              onClick={() => {
                setScene(id);
                setJoined(false);
              }}
            >
              {SHOWCASE_LABELS[id]}
            </button>
          ))}
        </div>
        {joined ? (
          <p role="status" data-showcase-demo-state="">
            מצב הדגמה: לא נוצרה הזמנה ולא נשמר תשלום.
          </p>
        ) : null}
      </section>
      <GuestEventView
        key={scene}
        preview={preview}
        onPreviewJoin={() => setJoined(true)}
      />
    </>
  );
}
