"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { guestEventPath } from "@/lib/events";
import { fromRouteParam } from "@/lib/events/slug";
import {
  fileToDataUrl,
  formatGiftAmount,
  getContributionsTotal,
  loadContributions,
  loadGuestGreeting,
  saveGuestGreeting,
  type GuestContribution,
} from "@/lib/guest-draft";
import styles from "../flagship.module.css";

const greetingPrompts = [
  "מזל טוב! שיהיה יום מלא שמחה.",
  "אוהבים ושמחים לחגוג איתך.",
  "מאחלים שנה של רגעים יפים.",
];

const actionClass =
  "inline-flex h-12 cursor-pointer items-center justify-center rounded-full border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-brand-soft";

const guestMediaEnabled = false;

export default function GuestGreetingForm() {
  const router = useRouter();
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [text, setText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [audioDataUrl, setAudioDataUrl] = useState("");
  const [audioName, setAudioName] = useState("");
  const [videoDataUrl, setVideoDataUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [contributions, setContributions] = useState<GuestContribution[]>([]);
  const [ready, setReady] = useState(false);
  const [continueError, setContinueError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!slug) {
        return;
      }

      const greeting = loadGuestGreeting(slug);
      const loaded = loadContributions(slug);

      if (cancelled) {
        return;
      }

      setText(greeting.text);
      setImageDataUrl(
        greeting.imageDataUrl.startsWith("data:") ? greeting.imageDataUrl : "",
      );
      setAudioDataUrl(
        greeting.audioDataUrl.startsWith("data:") ? greeting.audioDataUrl : "",
      );
      setAudioName(greeting.audioName);
      setVideoDataUrl(
        greeting.videoDataUrl.startsWith("data:") ? greeting.videoDataUrl : "",
      );
      setVideoName(greeting.videoName);
      setContributions(loaded);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const total = getContributionsTotal(contributions);

  function persistGreeting() {
    saveGuestGreeting(slug, {
      text,
      imageDataUrl,
      audioDataUrl,
      audioName,
      videoDataUrl,
      videoName,
    });
  }

  async function handleImage(file?: File) {
    if (!file) {
      return;
    }
    setImageDataUrl(await fileToDataUrl(file));
  }

  async function handleAudioFile(file?: File) {
    if (!file) {
      return;
    }
    setAudioName(file.name);
    setAudioDataUrl(await fileToDataUrl(file));
  }

  async function handleVideo(file?: File) {
    if (!file) {
      return;
    }
    setVideoName(file.name);
    setVideoDataUrl(await fileToDataUrl(file));
  }

  async function startRecording() {
    setRecordError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioName("הודעה קולית");
        setAudioDataUrl(await fileToDataUrl(blob));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setRecordError("לא ניתן להפעיל את המיקרופון. אפשר להעלות קובץ קולי.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  if (!ready) {
    return <p className={styles.quietLine}>טוענים את הברכה...</p>;
  }

  function applyPrompt(prompt: string) {
    setText((current) => {
      if (!current.trim() || greetingPrompts.includes(current)) {
        return prompt;
      }
      return current;
    });
  }

  return (
    <form
      className={styles.flowBody}
      onSubmit={(event) => {
        event.preventDefault();
        persistGreeting();
        if (total <= 0) {
          setContinueError("עדיין לא נבחרה מתנה.");
          return;
        }
        setContinueError("");
        router.push(guestEventPath(slug, "details"));
      }}
    >
      <section className={styles.card}>
        <h2>המתנה שלכם</h2>
        {contributions.length === 0 ? (
          <p className={styles.quietLine}>עדיין לא נבחרה מתנה.</p>
        ) : (
          contributions.map((item) => (
            <p key={item.giftId} className={styles.lineRow}>
              <span>{item.giftName}</span>
              <b>{formatGiftAmount(item.amount)}</b>
            </p>
          ))
        )}
        <p className={styles.totalLine}>
          <span>סה״כ</span>
          <span>{formatGiftAmount(total)}</span>
        </p>
      </section>

      <div className={styles.prompts} aria-label="הצעות לברכה">
        {greetingPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className={styles.prompt}
            aria-pressed={text === prompt}
            onClick={() => applyPrompt(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <label className={styles.stack}>
        <span>ברכה במילים שלכם (לא חובה)</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="או כותבים כאן משהו אישי..."
          rows={5}
        />
      </label>

      {guestMediaEnabled ? (
      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">
          אפשר גם להוסיף (לא חובה)
        </p>
        <div className="grid grid-cols-3 gap-2">
          <label className={actionClass}>
            תמונה
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => handleImage(event.target.files?.[0])}
            />
          </label>
          <label className={actionClass}>
            וידאו
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(event) => handleVideo(event.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            className={actionClass}
          >
            {recording ? "עצירה" : "הודעה קולית"}
          </button>
        </div>
        <label className={`${actionClass} w-full`}>
          העלאת קובץ קולי
          <input
            type="file"
            accept="audio/*"
            className="sr-only"
            onChange={(event) => handleAudioFile(event.target.files?.[0])}
          />
        </label>
        {recordError ? (
          <p className="text-sm text-brand">{recordError}</p>
        ) : null}

        {imageDataUrl ? (
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageDataUrl}
              alt="תמונה לברכה"
              className="h-40 w-full rounded-3xl object-cover"
            />
            <button
              type="button"
              onClick={() => setImageDataUrl("")}
              className="text-sm font-semibold text-brand"
            >
              הסרת תמונה
            </button>
          </div>
        ) : null}

        {videoDataUrl ? (
          <div className="flex flex-col gap-2">
            <video
              src={videoDataUrl}
              controls
              className="h-44 w-full rounded-3xl bg-black object-cover"
            />
            {videoName ? <p className="text-sm text-muted">{videoName}</p> : null}
            <button
              type="button"
              onClick={() => {
                setVideoDataUrl("");
                setVideoName("");
              }}
              className="text-sm font-semibold text-brand"
            >
              הסרת סרטון
            </button>
          </div>
        ) : null}

        {audioDataUrl ? (
          <div className="flex flex-col gap-2">
            <audio controls src={audioDataUrl} className="w-full" />
            {audioName ? <p className="text-sm text-muted">{audioName}</p> : null}
            <button
              type="button"
              onClick={() => {
                setAudioDataUrl("");
                setAudioName("");
              }}
              className="text-sm font-semibold text-brand"
            >
              הסרת הודעה קולית
            </button>
          </div>
        ) : null}
      </section>
      ) : null}

      {continueError ? (
        <p className={styles.fieldError} role="alert">
          {continueError}
        </p>
      ) : null}
      <button type="submit" className={styles.cta}>
        ממשיכים · {formatGiftAmount(total)}
      </button>
      <button
        type="button"
        onClick={() => {
          persistGreeting();
          router.push(guestEventPath(slug));
        }}
        className={styles.ghost}
      >
        חזרה לבחירת המתנות
      </button>
    </form>
  );
}
