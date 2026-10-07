"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getLastCreatedSlug, guestEventPath } from "@/lib/events";
import { normalizeEventSlug } from "@/lib/events/slug";
import { loadCreatedHostAccessCode } from "@/lib/host/created-code";

export default function SuccessActions() {
  const searchParams = useSearchParams();
  const [toast, setToast] = useState("");
  const [path, setPath] = useState("");
  const [absoluteUrl, setAbsoluteUrl] = useState("");
  const [eventSlug, setEventSlug] = useState("");
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      const slug = normalizeEventSlug(
        searchParams.get("slug") || getLastCreatedSlug(),
      );
      if (!slug || cancelled) {
        return;
      }

      const nextPath = guestEventPath(slug);
      setEventSlug(slug);
      setPath(nextPath);
      setAbsoluteUrl(`${window.location.origin}${nextPath}`);
      setAccessCode(loadCreatedHostAccessCode(slug));
    });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function copyText(value: string, message: string) {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  async function copyLink(message: string) {
    await copyText(absoluteUrl, message);
  }

  async function shareTo(url: string, message: string) {
    await copyLink(message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const whatsappUrl = absoluteUrl
    ? `https://wa.me/?text=${encodeURIComponent(`מוזמנים לאירוע: ${absoluteUrl}`)}`
    : "#";

  return (
    <div className="mt-8 flex flex-col gap-3">
      {toast ? (
        <p className="rounded-2xl bg-brand-soft px-4 py-3 text-center text-sm font-medium text-brand">
          {toast}
        </p>
      ) : null}

      <p
        dir="ltr"
        className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-foreground"
      >
        {absoluteUrl || "הקישור יופיע אחרי יצירת האירוע"}
      </p>

      {eventSlug ? (
        <p className="text-center text-sm text-muted">
          שם האירוע לכניסת המארח:{" "}
          <span dir="ltr" className="font-semibold text-foreground">
            {eventSlug}
          </span>
        </p>
      ) : null}

      {accessCode ? (
        <div className="rounded-3xl border border-border bg-white px-4 py-4 text-center">
          <p className="text-sm font-semibold text-foreground">
            קוד ניהול פרטי לאירוע
          </p>
          <p
            dir="ltr"
            className="mt-3 text-2xl font-bold tracking-[0.2em] text-brand"
          >
            {accessCode}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            זהו קוד הניהול הפרטי שלכם. שמרו אותו במקום בטוח. מי שמחזיק בקוד
            יוכל להיכנס לניהול האירוע. אל תשתפו אותו בקישור לאורחים.
          </p>
          <button
            type="button"
            onClick={() => copyText(accessCode, "קוד הניהול הועתק")}
            className="mt-4 inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-border bg-white px-6 text-sm font-semibold text-foreground hover:bg-brand-soft"
          >
            העתקת קוד הניהול
          </button>
        </div>
      ) : null}

      {path ? (
        <Link
          href={path}
          className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground transition-colors hover:bg-brand-soft"
        >
          פתיחת עמוד האירוע
        </Link>
      ) : null}

      <button
        type="button"
        disabled={!absoluteUrl}
        onClick={() => copyLink("הקישור הועתק")}
        className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand/40"
      >
        העתקת קישור
      </button>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground transition-colors hover:bg-brand-soft"
      >
        שיתוף ב-WhatsApp
      </a>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!absoluteUrl}
          onClick={() =>
            shareTo(
              "https://www.instagram.com/",
              "הקישור הועתק — אפשר להדביק אותו באינסטגרם",
            )
          }
          className="inline-flex h-12 cursor-pointer items-center justify-center rounded-full border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-brand-soft disabled:cursor-not-allowed disabled:text-muted"
        >
          Instagram
        </button>
        <button
          type="button"
          disabled={!absoluteUrl}
          onClick={() =>
            shareTo(
              "https://www.tiktok.com/",
              "הקישור הועתק — אפשר להדביק אותו בטיקטוק",
            )
          }
          className="inline-flex h-12 cursor-pointer items-center justify-center rounded-full border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-brand-soft disabled:cursor-not-allowed disabled:text-muted"
        >
          TikTok
        </button>
      </div>
    </div>
  );
}
