"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  loadEventDraft,
  resetEventCreationDraft,
  saveEventDraft,
} from "@/lib/event-draft";
import { useIsClient } from "@/lib/use-is-client";

const eventTypes = [
  "יום הולדת",
  "בר מצווה",
  "בת מצווה",
  "חתונה",
  "ברית / בריתה",
  "חלאקה",
  "חינה",
  "אחר",
];

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

export default function CreateEventForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startNew = searchParams.get("new") === "1";
  const isClient = useIsClient();
  const [ready, setReady] = useState(false);
  const [eventType, setEventType] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [hostName, setHostName] = useState("");

  if (isClient && !ready) {
    if (startNew) {
      resetEventCreationDraft();
    }
    const draft = loadEventDraft();
    setEventType(draft.eventType);
    setEventName(draft.eventName);
    setEventDate(draft.eventDate);
    setHostName(draft.hostName);
    setReady(true);
  }

  useEffect(() => {
    if (startNew && ready) {
      router.replace("/create-event");
    }
  }, [ready, router, startNew]);

  function persistBasics(patch: {
    eventType?: string;
    eventName?: string;
    eventDate?: string;
    hostName?: string;
  }) {
    saveEventDraft(patch);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveEventDraft({
      eventType,
      eventName,
      eventDate,
      hostName,
    });
    router.push("/create-event/gifts");
  }

  function startNewEvent() {
    resetEventCreationDraft();
    setEventType("");
    setEventName("");
    setEventDate("");
    setHostName("");
  }

  if (!ready) {
    return null;
  }

  const canStartNew = Boolean(
    eventType || eventName.trim() || eventDate || hostName.trim(),
  );

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-7">
      {canStartNew ? (
        <button
          type="button"
          onClick={startNewEvent}
          className="text-sm font-semibold text-brand hover:text-brand-hover"
        >
          התחלת אירוע חדש
        </button>
      ) : null}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-foreground">
          איזה אירוע חוגגים?
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {eventTypes.map((type) => {
            const selected = eventType === type;

            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setEventType(type);
                  persistBasics({ eventType: type });
                }}
                aria-pressed={selected}
                className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors ${
                  selected
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-border bg-white text-foreground hover:bg-brand-soft"
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">שם האירוע</span>
        <input
          type="text"
          name="eventName"
          value={eventName}
          onChange={(event) => {
            const value = event.target.value;
            setEventName(value);
            persistBasics({ eventName: value });
          }}
          placeholder="יום ההולדת של יובל"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">מתי חוגגים?</span>
        <input
          type="date"
          name="eventDate"
          value={eventDate}
          onChange={(event) => {
            const value = event.target.value;
            setEventDate(value);
            persistBasics({ eventDate: value });
          }}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">
          שם בעל/ת האירוע
        </span>
        <input
          type="text"
          name="hostName"
          value={hostName}
          onChange={(event) => {
            const value = event.target.value;
            setHostName(value);
            persistBasics({ hostName: value });
          }}
          className={fieldClass}
        />
      </label>

      <button
        type="submit"
        className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        ממשיכים לבחירת המתנות
      </button>
    </form>
  );
}
