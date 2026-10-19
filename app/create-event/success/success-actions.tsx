"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BETA_CLARITY } from "@/app/design/beta-notice";
import styles from "@/app/design/host-experience.module.css";
import { peekCreatedAccess } from "@/app/create-event/created-access-memory";
import { guestEventPath } from "@/lib/events";
import { normalizeEventSlug } from "@/lib/events/slug";

const SAVE_CODE = "שמרו את הקוד — בלעדיו אי אפשר לנהל את האירוע";

export default function SuccessActions() {
  const searchParams = useSearchParams();
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const [path, setPath] = useState("");
  const [absoluteUrl, setAbsoluteUrl] = useState("");
  const [eventSlug, setEventSlug] = useState("");
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }
      const slug = normalizeEventSlug(searchParams.get("slug") || "");
      if (!slug) {
        setReady(true);
        return;
      }

      const nextPath = guestEventPath(slug);
      setEventSlug(slug);
      setPath(nextPath);
      setAbsoluteUrl(`${window.location.origin}${nextPath}`);
      setAccessCode(peekCreatedAccess(slug));
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!accessCode) {
      return;
    }

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [accessCode]);

  async function copyText(value: string, message: string) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setToast(message);
    } catch {
      setToast("לא הצלחנו להעתיק. סמנו את הקוד והעתיקו אותו ידנית.");
    }
    window.setTimeout(() => setToast(""), 3000);
  }

  function confirmLeave(event: { preventDefault: () => void }) {
    if (!accessCode) {
      return;
    }
    if (!window.confirm(SAVE_CODE)) {
      event.preventDefault();
    }
  }

  if (!ready) {
    return <p className="mt-10 text-center text-base text-muted">טוענים...</p>;
  }

  if (!eventSlug) {
    return (
      <div className="mt-10 flex flex-col gap-4">
        <h1 className={styles.title}>עדיין אין אירוע מוכן</h1>
        <div className={styles.empty}>
          <p>
            המסך הזה נפתח רק אחרי יצירת אירוע. חזרו ליצירה, ובסיום הקוד יוצג כאן פעם אחת.
          </p>
        </div>
        <Link
          href="/create-event"
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-lg font-bold text-white hover:bg-brand-hover"
        >
          חזרה ליצירת אירוע
        </Link>
      </div>
    );
  }

  const whatsappUrl = absoluteUrl
    ? `https://wa.me/?text=${encodeURIComponent(`מוזמנים לאירוע: ${absoluteUrl}`)}`
    : "#";

  return (
    <div className="mt-8 flex flex-col gap-3">
      <h1 className={styles.title}>האירוע שלכם מוכן</h1>
      <p className={styles.lede}>עכשיו נשאר רק להזמין את האורחים.</p>
      <p className={styles.betaNote}>{BETA_CLARITY}</p>

      {toast ? (
        <p role="status" className="rounded-2xl bg-brand-soft px-4 py-3 text-center text-sm font-medium text-brand">
          {toast}
        </p>
      ) : null}

      {accessCode ? (
        <div className={styles.codeCard}>
          <p className={styles.codeLabel}>קוד ניהול פרטי לאירוע</p>
          <p dir="ltr" className={styles.codeValue}>
            {accessCode}
          </p>
          <p className={styles.codeWarn}>{SAVE_CODE}</p>
          <p className={styles.codeHelp}>
            הקוד מוצג רק עכשיו, ואינו נשמר בדפדפן או בכתובת. מי שמחזיק בו יכול לנהל את האירוע. אל תשתפו אותו עם האורחים.
          </p>
          <button
            type="button"
            onClick={() => copyText(accessCode, "קוד הניהול הועתק")}
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-lg font-bold text-white hover:bg-brand-hover"
          >
            העתקת קוד הניהול
          </button>
        </div>
      ) : (
        <div className={styles.empty}>
          <p className={styles.codeWarn}>{SAVE_CODE}</p>
          <p className="mt-3">
            הקוד הוצג רק מיד אחרי היצירה ואינו נשמר כאן. אם יצאתם בלי לשמור אותו, אי אפשר להציג אותו שוב מהדפדפן.
          </p>
        </div>
      )}

      <p dir="ltr" className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-foreground">
        {absoluteUrl}
      </p>

      <p className="text-center text-sm text-muted">
        שם האירוע לכניסת המארח:{" "}
        <span dir="ltr" className="font-semibold text-foreground">
          {eventSlug}
        </span>
      </p>

      {path ? (
        <Link
          href={path}
          onClick={confirmLeave}
          className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground hover:bg-brand-soft"
        >
          פתיחת עמוד האירוע
        </Link>
      ) : null}

      <button
        type="button"
        disabled={!absoluteUrl}
        onClick={() => copyText(absoluteUrl, "הקישור הועתק")}
        className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground hover:bg-brand-soft disabled:cursor-not-allowed disabled:text-muted"
      >
        העתקת קישור
      </button>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={confirmLeave}
        className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground hover:bg-brand-soft"
      >
        שיתוף ב-WhatsApp
      </a>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!absoluteUrl}
          onClick={() => {
            void copyText(absoluteUrl, "הקישור הועתק — אפשר להדביק אותו באינסטגרם");
            window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
          }}
          className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-brand-soft disabled:cursor-not-allowed disabled:text-muted"
        >
          Instagram
        </button>
        <button
          type="button"
          disabled={!absoluteUrl}
          onClick={() => {
            void copyText(absoluteUrl, "הקישור הועתק — אפשר להדביק אותו בטיקטוק");
            window.open("https://www.tiktok.com/", "_blank", "noopener,noreferrer");
          }}
          className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-brand-soft disabled:cursor-not-allowed disabled:text-muted"
        >
          TikTok
        </button>
      </div>
    </div>
  );
}
