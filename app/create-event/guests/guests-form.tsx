"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  loadEventDraft,
  saveEventDraft,
  type Guest,
} from "@/lib/event-draft";
import {
  isValidGuestPhone,
  normalizeGuestName,
  normalizeGuestPhone,
} from "@/lib/host/guest-fields";
import {
  downloadGuestExcelTemplate,
  parseGuestExcelFile,
  type ExcelRowIssue,
} from "@/lib/guests/excel";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

export default function GuestsForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [excelFileName, setExcelFileName] = useState("");
  const [formError, setFormError] = useState("");
  const [importSummary, setImportSummary] = useState("");
  const [importIssues, setImportIssues] = useState<ExcelRowIssue[]>([]);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      const draft = loadEventDraft();
      if (cancelled) {
        return;
      }
      setGuests(draft.guests);
      setExcelFileName(draft.excelFileName);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function persistGuests(next: Guest[]) {
    setGuests(next);
    saveEventDraft({ guests: next, excelFileName: "" });
  }

  function addGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedName = normalizeGuestName(name);
    const parsedPhone = normalizeGuestPhone(phone);

    if (!parsedName || !phone.trim()) {
      setFormError("נא להזין שם ומספר טלפון.");
      return;
    }
    if (!isValidGuestPhone(parsedPhone)) {
      setFormError("נא להזין מספר טלפון תקין.");
      return;
    }
    if (
      guests.some((guest) => normalizeGuestPhone(guest.phone) === parsedPhone)
    ) {
      setFormError("מספר הטלפון כבר קיים ברשימה.");
      return;
    }

    setFormError("");
    persistGuests([
      ...guests,
      {
        id: crypto.randomUUID(),
        name: parsedName,
        phone: parsedPhone,
      },
    ]);
    setName("");
    setPhone("");
  }

  function removeGuest(id: string) {
    persistGuests(guests.filter((guest) => guest.id !== id));
    if (editingId === id) {
      setEditingId("");
    }
  }

  function startEdit(guest: Guest) {
    setEditingId(guest.id);
    setEditName(guest.name);
    setEditPhone(guest.phone);
    setFormError("");
  }

  function saveEdit(id: string) {
    const parsedName = normalizeGuestName(editName);
    const parsedPhone = normalizeGuestPhone(editPhone);

    if (!parsedName || !editPhone.trim()) {
      setFormError("נא להזין שם ומספר טלפון.");
      return;
    }
    if (!isValidGuestPhone(parsedPhone)) {
      setFormError("נא להזין מספר טלפון תקין.");
      return;
    }
    if (
      guests.some(
        (guest) =>
          guest.id !== id && normalizeGuestPhone(guest.phone) === parsedPhone,
      )
    ) {
      setFormError("מספר הטלפון כבר קיים ברשימה.");
      return;
    }

    persistGuests(
      guests.map((guest) =>
        guest.id === id
          ? { ...guest, name: parsedName, phone: parsedPhone }
          : guest,
      ),
    );
    setEditingId("");
    setFormError("");
  }

  async function importExcel(file: File) {
    setFormError("");
    setImportSummary("");
    setImportIssues([]);
    setImporting(true);

    try {
      const result = await parseGuestExcelFile(file, guests);
      const next = [...guests, ...result.guests];
      persistGuests(next);
      setExcelFileName(file.name);

      const validCount = result.guests.length;
      const issueCount = result.issues.length;
      const parts = [`נמצאו ${validCount} מוזמנים תקינים`];
      if (issueCount > 0) {
        parts.push(`${issueCount} שורות דורשות תיקון`);
      }
      if (result.duplicateCount > 0) {
        parts.push("כפילויות לא נוספו פעם נוספת");
      }
      setImportSummary(parts.join(". "));
      setImportIssues(result.issues);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "ייבוא הקובץ נכשל.",
      );
    } finally {
      setImporting(false);
    }
  }

  function continueToPreview() {
    if (guests.length === 0) {
      setFormError("הוסיפו לפחות אורח אחד לרשימה.");
      return;
    }

    saveEventDraft({ guests, excelFileName: "" });
    router.push("/create-event/preview");
  }

  if (!ready) {
    return null;
  }

  const canContinue = guests.length > 0;

  return (
    <div className="mt-10 flex flex-col gap-8">
      <section>
        <h2 className="text-base font-bold text-foreground">הוספת אורח</h2>
        <form onSubmit={addGuest} className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">שם האורח</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">מספר טלפון</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={fieldClass}
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground transition-colors hover:bg-brand-soft"
          >
            הוספה לרשימה
          </button>
        </form>

        <p className="mt-5 text-sm font-medium text-muted">
          נוספו {guests.length} אורחים
        </p>

        {guests.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {guests.map((guest) => (
              <li
                key={guest.id}
                className="rounded-2xl border border-border bg-white px-4 py-3"
              >
                {editingId === guest.id ? (
                  <div className="flex flex-col gap-3">
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className={fieldClass}
                      aria-label="שם האורח"
                    />
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(event) => setEditPhone(event.target.value)}
                      className={fieldClass}
                      dir="ltr"
                      aria-label="מספר טלפון"
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => saveEdit(guest.id)}
                        className="text-sm font-semibold text-brand"
                      >
                        שמירה
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId("")}
                        className="text-sm font-semibold text-muted"
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{guest.name}</p>
                      <p className="mt-1 text-sm text-muted" dir="ltr">
                        {guest.phone}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        onClick={() => startEdit(guest)}
                        className="text-sm font-semibold text-foreground"
                      >
                        עריכה
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGuest(guest.id)}
                        className="text-sm font-semibold text-brand"
                      >
                        הסרה
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-3xl border border-border bg-white p-5">
        <h2 className="text-base font-bold text-foreground">העלאת רשימת אורחים</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          הורידו את התבנית, מלאו שם וטלפון, והעלו את הקובץ. אורחים ידניים לא
          יימחקו.
        </p>
        <button
          type="button"
          onClick={() => {
            void downloadGuestExcelTemplate().catch(() => {
              setFormError("הורדת התבנית נכשלה.");
            });
          }}
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground hover:bg-brand-soft"
        >
          הורדת תבנית Excel
        </button>
        <label className="mt-3 inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground hover:bg-brand-soft">
          {importing ? "מייבאים..." : "העלאת קובץ"}
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={importing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                void importExcel(file);
              }
            }}
          />
        </label>
        {excelFileName ? (
          <p className="mt-3 text-sm font-medium text-foreground">{excelFileName}</p>
        ) : null}
        {importSummary ? (
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {importSummary}
          </p>
        ) : null}
        {importIssues.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
            {importIssues.slice(0, 20).map((issue) => (
              <li key={`${issue.row}-${issue.reason}-${issue.phone}`}>
                שורה {issue.row}
                {issue.name ? ` · ${issue.name}` : ""}: {issue.reason}
              </li>
            ))}
            {importIssues.length > 20 ? (
              <li>ועוד {importIssues.length - 20} שורות דורשות תיקון</li>
            ) : null}
          </ul>
        ) : null}
      </section>

      {formError ? (
        <p className="text-center text-sm text-brand">{formError}</p>
      ) : null}

      <button
        type="button"
        disabled={!canContinue}
        onClick={continueToPreview}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand/40 disabled:hover:bg-brand/40"
      >
        תצוגה מקדימה של האירוע
      </button>
    </div>
  );
}
