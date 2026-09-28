"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loadEventDraft, saveEventDraft } from "@/lib/event-draft";
import { clearSelectedGifts } from "@/lib/gifts";
import { useIsClient } from "@/lib/use-is-client";

const defaultAmounts = ["150", "250", "350", "500"];

type AmountRow = {
  id: string;
  value: string;
};

function createRows(values: string[]): AmountRow[] {
  return values.map((value) => ({
    id: crypto.randomUUID(),
    value,
  }));
}

function parseAmountRows(rows: AmountRow[]) {
  return rows
    .map((row) => Number(row.value.replace(/[^\d.]/g, "")))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
}

export default function MoneyGiftForm() {
  const router = useRouter();
  const isClient = useIsClient();
  const [ready, setReady] = useState(false);
  const [amounts, setAmounts] = useState<AmountRow[]>([]);
  const [allowCustomAmount, setAllowCustomAmount] = useState(true);
  const [display, setDisplay] = useState<"amounts" | "hidden">("amounts");

  if (isClient && !ready) {
    const draft = loadEventDraft();
    setAmounts(
      createRows(
        draft.moneyAmounts.length > 0
          ? draft.moneyAmounts.map((amount) => String(amount))
          : defaultAmounts,
      ),
    );
    setAllowCustomAmount(draft.allowCustomAmount !== false);
    setDisplay(draft.moneyDisplay === "hidden" ? "hidden" : "amounts");
    setReady(true);
  }

  function persistMoney(
    rows: AmountRow[],
    allow: boolean,
    moneyDisplay: "amounts" | "hidden",
  ) {
    saveEventDraft({
      giftMode: "money",
      moneyAmounts: parseAmountRows(rows),
      allowCustomAmount: allow,
      moneyDisplay,
    });
  }

  function continueToDetails() {
    clearSelectedGifts();
    persistMoney(amounts, allowCustomAmount, display);
    router.push("/create-event/details");
  }

  if (!ready) {
    return null;
  }

  return (
    <div className="mt-10 flex flex-col gap-8">
      <section>
        <h2 className="text-base font-bold text-foreground">
          הסכומים שיוצעו לאורחים
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          אפשר לערוך, להסיר או להוסיף סכומים. האורחים יראו אותם כאפשרויות
          לבחירה.
        </p>
        <ul className="mt-4 flex flex-col gap-3">
          {amounts.map((row, index) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                {index + 1}
              </span>
              <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-dashed border-border bg-background px-3">
                <span className="ml-2 shrink-0 text-sm text-muted">₪</span>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  aria-label={`סכום מוצע ${index + 1}`}
                  value={row.value}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAmounts((current) => {
                      const next = current.map((item) =>
                        item.id === row.id ? { ...item, value } : item,
                      );
                      persistMoney(next, allowCustomAmount, display);
                      return next;
                    });
                  }}
                  className="w-full bg-transparent text-base font-medium text-foreground outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setAmounts((current) => {
                    const next = current.filter((item) => item.id !== row.id);
                    persistMoney(next, allowCustomAmount, display);
                    return next;
                  })
                }
                className="shrink-0 text-sm font-semibold text-brand hover:text-brand-hover"
              >
                הסרה
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            setAmounts((current) => {
              const next = [...current, { id: crypto.randomUUID(), value: "" }];
              persistMoney(next, allowCustomAmount, display);
              return next;
            })
          }
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-brand-soft"
        >
          הוספת סכום
        </button>
      </section>

      <label className="flex items-center gap-3 rounded-3xl border border-border bg-white px-4 py-4">
        <input
          type="checkbox"
          checked={allowCustomAmount}
          onChange={(event) => {
            const checked = event.target.checked;
            setAllowCustomAmount(checked);
            persistMoney(amounts, checked, display);
          }}
          className="h-5 w-5 accent-brand"
        />
        <span className="text-sm font-semibold text-foreground">
          אפשר לאורחים לבחור סכום אחר
        </span>
      </label>

      <section>
        <h2 className="text-base font-bold text-foreground">
          האם להציג את סכום המתנה?
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setDisplay("amounts");
              persistMoney(amounts, allowCustomAmount, "amounts");
            }}
            aria-pressed={display === "amounts"}
            className={`rounded-3xl border p-5 text-right ${
              display === "amounts"
                ? "border-brand bg-brand-soft"
                : "border-border bg-white"
            }`}
          >
            <p className="font-bold text-foreground">כן, להציג סכומים</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              האורחים יוכלו לבחור אחד מהסכומים שהגדרתם או סכום אחר.
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setDisplay("hidden");
              persistMoney(amounts, allowCustomAmount, "hidden");
            }}
            aria-pressed={display === "hidden"}
            className={`rounded-3xl border p-5 text-right ${
              display === "hidden"
                ? "border-brand bg-brand-soft"
                : "border-border bg-white"
            }`}
          >
            <p className="font-bold text-foreground">לא, בלי להציג סכומים</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              האורחים יוכלו להשתתף במתנה בלי שסכומים יוצגו בצורה בולטת.
            </p>
          </button>
        </div>
      </section>

      <button
        type="button"
        onClick={continueToDetails}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        ממשיכים
      </button>
    </div>
  );
}
