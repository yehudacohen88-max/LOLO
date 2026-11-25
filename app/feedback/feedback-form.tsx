"use client";

import { useState, type FormEvent } from "react";
import { PILOT_FEEDBACK_CLOSED } from "@/lib/pilot/feedback";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none focus:border-brand";

type FeedbackState = {
  role: string;
  device: string;
  completed: string;
  clarity: string;
  demoPaymentClear: string;
  wouldUse: string;
  notes: string;
};

const EMPTY: FeedbackState = {
  role: "",
  device: "",
  completed: "",
  clarity: "",
  demoPaymentClear: "",
  wouldUse: "",
  notes: "",
};

function Choice({
  name,
  value,
  checked,
  label,
  required = false,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-base">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        required={required}
        onChange={() => onChange(value)}
        className="h-4 w-4 accent-brand"
      />
      <span>{label}</span>
    </label>
  );
}

export default function FeedbackForm() {
  const [fields, setFields] = useState<FeedbackState>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function setField(key: keyof FeedbackState, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: fields.role,
          device: fields.device,
          completed: fields.completed,
          clarity: Number(fields.clarity),
          demoPaymentClear:
            fields.demoPaymentClear === "yes"
              ? true
              : fields.demoPaymentClear === "no"
                ? false
                : null,
          wouldUse: fields.wouldUse,
          notes: fields.notes,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || PILOT_FEEDBACK_CLOSED);
      }
      setDone(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : PILOT_FEEDBACK_CLOSED);
      setSaving(false);
    }
  }

  if (done) {
    return (
      <p className="mt-8 text-base leading-relaxed text-foreground" role="status">
        תודה. המשוב נשמר. לא נגבה כסף.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">מי אתם בניסיון הזה?</legend>
        <Choice name="role" value="host" checked={fields.role === "host"} label="מארח" required onChange={(value) => setField("role", value)} />
        <Choice name="role" value="guest" checked={fields.role === "guest"} label="אורח" onChange={(value) => setField("role", value)} />
        <Choice name="role" value="store" checked={fields.role === "store"} label="חנות" onChange={(value) => setField("role", value)} />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">באיזה מסך עברתם?</legend>
        <Choice name="device" value="phone" checked={fields.device === "phone"} label="טלפון" required onChange={(value) => setField("device", value)} />
        <Choice name="device" value="desktop" checked={fields.device === "desktop"} label="מחשב" onChange={(value) => setField("device", value)} />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">האם סיימתם את המסלול?</legend>
        <Choice name="completed" value="yes" checked={fields.completed === "yes"} label="כן" required onChange={(value) => setField("completed", value)} />
        <Choice name="completed" value="partial" checked={fields.completed === "partial"} label="חלקית" onChange={(value) => setField("completed", value)} />
        <Choice name="completed" value="no" checked={fields.completed === "no"} label="לא" onChange={(value) => setField("completed", value)} />
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">עד כמה היה ברור מה לעשות עכשיו? 1 לא ברור, 5 ברור מאוד</span>
        <select
          value={fields.clarity}
          onChange={(event) => setField("clarity", event.target.value)}
          required
          className={fieldClass}
        >
          <option value="">בחירה</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">האם היה ברור שלא נגבה מכם כסף?</legend>
        <Choice
          name="demoPaymentClear"
          value="yes"
          checked={fields.demoPaymentClear === "yes"}
          label="כן"
          required
          onChange={(value) => setField("demoPaymentClear", value)}
        />
        <Choice
          name="demoPaymentClear"
          value="no"
          checked={fields.demoPaymentClear === "no"}
          label="לא"
          onChange={(value) => setField("demoPaymentClear", value)}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">האם הייתם משתמשים בזה באירוע אמיתי?</legend>
        <Choice name="wouldUse" value="yes" checked={fields.wouldUse === "yes"} label="כן" required onChange={(value) => setField("wouldUse", value)} />
        <Choice name="wouldUse" value="maybe" checked={fields.wouldUse === "maybe"} label="אולי" onChange={(value) => setField("wouldUse", value)} />
        <Choice name="wouldUse" value="no" checked={fields.wouldUse === "no"} label="לא" onChange={(value) => setField("wouldUse", value)} />
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">מה עבד, ומה בלבל? אפשר להשאיר ריק</span>
        <textarea
          value={fields.notes}
          onChange={(event) => setField("notes", event.target.value)}
          maxLength={1000}
          rows={5}
          className="rounded-2xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none focus:border-brand"
        />
      </label>

      {error ? (
        <p className="text-sm text-brand" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
      >
        {saving ? "שולחים..." : "שליחת משוב"}
      </button>
    </form>
  );
}
