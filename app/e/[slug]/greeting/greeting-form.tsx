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

const actionClass =
  "inline-flex h-12 cursor-pointer items-center justify-center rounded-full border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-brand-soft";

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
    return null;
  }

  return (
    <form
      className="mt-10 flex flex-col gap-7 pb-8"
      onSubmit={(event) => {
        event.preventDefault();
        persistGreeting();
        router.push(guestEventPath(slug, "details"));
      }}
    >
      <section className="rounded-3xl border border-border bg-white p-5">
        <h2 className="text-base font-bold text-foreground">המתנה שלכם</h2>
        {contributions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">עדיין לא נבחרה מתנה.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {contributions.map((item) => (
              <li
                key={item.giftId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="font-medium text-foreground">{item.giftName}</span>
                <span className="font-semibold text-brand">
                  {formatGiftAmount(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-base font-bold text-brand">
          סה״כ: {formatGiftAmount(total)}
        </p>
      </section>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">
          ברכה בכתב (לא חובה)
        </span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="מזל טוב! מאחלים לכם..."
          rows={5}
          className="rounded-3xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand"
        />
      </label>

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

      <button
        type="submit"
        className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover"
      >
        ממשיכים לתשלום • {formatGiftAmount(total)}
      </button>
      <button
        type="button"
        onClick={() => {
          persistGreeting();
          router.push(guestEventPath(slug));
        }}
        className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground hover:bg-brand-soft"
      >
        חזרה לבחירת המתנות
      </button>
    </form>
  );
}
