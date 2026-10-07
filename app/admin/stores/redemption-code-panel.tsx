"use client";

import { useEffect, useState } from "react";
import { formatVoucherWhen } from "@/lib/vouchers/labels";

export default function RedemptionCodePanel({ storeId }: { storeId: string }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/admin/stores/${storeId}/redemption-code`);
        const payload = (await response.json()) as {
          configured?: boolean;
          updatedAt?: string | null;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "טעינת קוד הכניסה נכשלה.");
        }
        if (!active) {
          return;
        }
        setConfigured(payload.configured === true);
        setUpdatedAt(payload.updatedAt ?? null);
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : "טעינת קוד הכניסה נכשלה.");
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [storeId]);

  async function rotate() {
    setSaving(true);
    setError("");
    setCopied(false);
    try {
      const response = await fetch(`/api/admin/stores/${storeId}/redemption-code`, {
        method: "POST",
      });
      const payload = (await response.json()) as { code?: string; error?: string };
      if (!response.ok || !payload.code) {
        throw new Error(payload.error || "יצירת קוד הכניסה נכשלה.");
      }
      setCode(payload.code);
      setConfigured(true);
      setUpdatedAt(new Date().toISOString());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "יצירת קוד הכניסה נכשלה.");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-border bg-white p-5">
      <h2 className="text-lg font-bold">קוד כניסה למימוש</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        הקוד מאפשר לעובדי בית העסק להיכנס למסך המימוש. אחרי היצירה אפשר לראות אותו רק עכשיו.
      </p>
      {configured == null && !error ? <p className="mt-4 text-sm text-muted">טוען...</p> : null}
      {configured != null ? (
        <p className="mt-4 text-sm">
          {configured
            ? `יש קוד פעיל${updatedAt ? ` · עודכן ${formatVoucherWhen(updatedAt)}` : ""}`
            : "עדיין אין קוד כניסה."}
        </p>
      ) : null}
      {code ? (
        <div className="mt-4 rounded-2xl bg-brand-soft px-4 py-4">
          <p className="text-sm text-muted">העתיקו את הקוד עכשיו. הוא לא יוצג שוב.</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-widest" dir="ltr">
            {code}
          </p>
          <button type="button" onClick={copy} className="mt-3 text-sm font-semibold text-brand">
            {copied ? "הועתק" : "העתקה"}
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-brand">{error}</p> : null}
      <button
        type="button"
        onClick={rotate}
        disabled={saving}
        className="mt-4 inline-flex h-12 items-center justify-center rounded-full border border-brand px-6 font-semibold text-brand disabled:opacity-60"
      >
        {saving ? "יוצרים..." : configured ? "החלפת קוד" : "יצירת קוד"}
      </button>
    </section>
  );
}
