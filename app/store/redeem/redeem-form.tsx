"use client";

import { useEffect, useRef, useState } from "react";
import { formatGiftAmount } from "@/lib/guest-draft";
import {
  formatVoucherWhen,
  methodTermLabel,
  partialTermLabel,
  topupTermLabel,
  voucherStatusLabel,
} from "@/lib/vouchers/labels";
import type { StoreVoucherLookup } from "@/lib/vouchers/types";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none focus:border-brand";

type ScanDetector = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

type RedeemResult = {
  amount: number;
  remainingAmount: number;
  status: StoreVoucherLookup["status"];
};

export default function RedeemForm() {
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<StoreVoucherLookup | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [scanMessage, setScanMessage] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (scanTimer.current) {
        window.clearInterval(scanTimer.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!scanning || !video || !stream) {
      return;
    }
    video.srcObject = stream;
    void video.play().catch(() => {
      setScanMessage("אין גישה למצלמה. אפשר להקליד את הקוד.");
    });
  }, [scanning]);

  function stopScan() {
    if (scanTimer.current) {
      window.clearInterval(scanTimer.current);
      scanTimer.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function lookupCode(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setError("יש להזין קוד שובר.");
      return;
    }
    setLooking(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/store/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const payload = (await response.json()) as StoreVoucherLookup & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "השובר לא נמצא.");
      }
      setLookup(payload);
      setAmount(String(payload.remainingAmount));
    } catch (nextError) {
      setLookup(null);
      setError(nextError instanceof Error ? nextError.message : "השובר לא נמצא.");
    } finally {
      setLooking(false);
    }
  }

  async function startScan() {
    setScanMessage("");
    const Detector = (
      window as Window & {
        BarcodeDetector?: new (options?: { formats?: string[] }) => ScanDetector;
      }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setScanMessage("הסריקה אינה זמינה בדפדפן הזה. אפשר להקליד את הקוד.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setScanning(true);
      const detector = new Detector({ formats: ["qr_code"] });
      scanTimer.current = window.setInterval(async () => {
        if (!videoRef.current) {
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes[0]?.rawValue?.trim();
          if (raw) {
            setCode(raw);
            stopScan();
            await lookupCode(raw);
          }
        } catch {
          // The camera may not have produced a frame yet.
        }
      }, 500);
    } catch {
      setScanMessage("אין גישה למצלמה. אפשר להקליד את הקוד.");
      stopScan();
    }
  }

  async function redeem() {
    if (!lookup) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/store/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          amount: lookup.terms.allowPartialRedemption ? Number(amount) : null,
          reference,
        }),
      });
      const payload = (await response.json()) as RedeemResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "המימוש נכשל.");
      }
      setResult(payload);
      setLookup(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "המימוש נכשל.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setCode("");
    setLookup(null);
    setResult(null);
    setAmount("");
    setReference("");
    setError("");
  }

  return (
    <div className="mt-8 flex flex-col gap-5">
      {result ? (
        <section className="rounded-3xl border border-border bg-white p-5">
          <h2 className="text-xl font-bold text-brand">המימוש נקלט</h2>
          <p className="mt-3 text-3xl font-bold">{formatGiftAmount(result.amount)}</p>
          <p className="mt-2 text-sm text-muted">
            יתרה בשובר: {formatGiftAmount(result.remainingAmount)} ·{" "}
            {voucherStatusLabel(result.status)}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white"
          >
            שובר נוסף
          </button>
        </section>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void lookupCode(code);
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">קוד השובר</span>
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setLookup(null);
              }}
              dir="ltr"
              autoComplete="off"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className={fieldClass}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={looking}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-brand px-5 text-base font-semibold text-white disabled:opacity-60"
            >
              {looking ? "בודקים..." : "בדיקת שובר"}
            </button>
            <button
              type="button"
              onClick={scanning ? stopScan : startScan}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-brand px-5 text-base font-semibold text-brand"
            >
              {scanning ? "עצירת סריקה" : "סריקת קוד"}
            </button>
          </div>
          {scanning ? (
            <video
              ref={videoRef}
              className="aspect-square w-full rounded-3xl bg-black object-cover"
              playsInline
              muted
              autoPlay
            />
          ) : null}
          {scanMessage ? <p className="text-sm text-muted">{scanMessage}</p> : null}
        </form>
      )}

      {lookup ? (
        <section className="rounded-3xl border border-border bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">{lookup.eventTitle || "אירוע"}</p>
              <h2 className="mt-1 text-xl font-bold">{lookup.giftTitle}</h2>
            </div>
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              {voucherStatusLabel(lookup.status)}
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold text-brand">
            {formatGiftAmount(lookup.remainingAmount)}
          </p>
          <p className="mt-1 text-sm text-muted">
            מתוך {formatGiftAmount(lookup.amount)} · בתוקף עד {formatVoucherWhen(lookup.expiresAt)}
          </p>
          <ul className="mt-4 flex flex-col gap-1 text-sm">
            <li>{partialTermLabel(lookup.terms)}</li>
            <li>{topupTermLabel(lookup.terms)}</li>
            <li>{methodTermLabel(lookup.terms)}</li>
          </ul>
          {lookup.blockedReason ? (
            <p className="mt-4 text-sm font-semibold text-brand">{lookup.blockedReason}</p>
          ) : (
            <div className="mt-5 flex flex-col gap-3">
              {lookup.terms.allowPartialRedemption ? (
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold">סכום למימוש</span>
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    inputMode="decimal"
                    dir="ltr"
                    className={fieldClass}
                  />
                </label>
              ) : (
                <p className="text-sm text-muted">המימוש יהיה על כל היתרה.</p>
              )}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold">אסמכתה, אם יש</span>
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <button
                type="button"
                onClick={redeem}
                disabled={saving}
                className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white disabled:opacity-60"
              >
                {saving ? "מממשים..." : "אישור מימוש"}
              </button>
            </div>
          )}
        </section>
      ) : null}

      {error ? <p className="text-sm text-brand">{error}</p> : null}
    </div>
  );
}
