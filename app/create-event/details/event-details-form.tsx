"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  formatEventDate,
  getVideoPreviewUrl,
  loadEventDraft,
  saveEventDraft,
  setVideoPreviewUrl,
} from "@/lib/event-draft";
import { ImagePrepareError } from "@/lib/images/prepare";
import { uploadImageFile } from "@/lib/images/upload-client";
import { useIsClient } from "@/lib/use-is-client";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

export default function EventDetailsForm() {
  const router = useRouter();
  const isClient = useIsClient();
  const [ready, setReady] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");

  if (isClient && !ready) {
    const draft = loadEventDraft();
    setEventDate(draft.eventDate);
    setImageDataUrl(draft.imageDataUrl);
    setVideoName(draft.videoName);
    setVideoUrl(getVideoPreviewUrl());
    setMessage(draft.message);
    setVenueName(draft.venueName);
    setAddress(draft.address);
    setEventTime(draft.eventTime);
    setReady(true);
  }

  function persistDetails(
    patch: Partial<{
      imageDataUrl: string;
      videoName: string;
      message: string;
      venueName: string;
      address: string;
      eventTime: string;
    }>,
  ) {
    saveEventDraft(patch);
  }

  async function handleImage(file?: File) {
    if (!file || imageUploading) {
      return;
    }

    setImageError("");
    setImageUploading(true);
    try {
      const url = await uploadImageFile(file, "cover");
      setImageDataUrl(url);
      persistDetails({ imageDataUrl: url });
    } catch (error) {
      setImageError(
        error instanceof ImagePrepareError
          ? error.message
          : "העלאת התמונה נכשלה. נסו שוב.",
      );
    } finally {
      setImageUploading(false);
    }
  }

  function handleVideo(file?: File) {
    if (!file) {
      return;
    }

    setVideoName(file.name);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoPreviewUrl(url);
    persistDetails({ videoName: file.name });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVideoPreviewUrl(videoUrl);
    persistDetails({
      imageDataUrl,
      videoName,
      message,
      venueName,
      address,
      eventTime,
    });
    router.push("/create-event/guests");
  }

  if (!ready) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-foreground">תמונה לאירוע</h2>
        {imageDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageDataUrl}
            alt="תצוגה מקדימה של תמונת האירוע"
            className="h-44 w-full rounded-3xl object-cover"
          />
        ) : (
          <div className="flex h-44 items-center justify-center rounded-3xl border border-dashed border-border bg-white text-sm text-muted">
            עדיין לא נבחרה תמונה
          </div>
        )}
        <label
          className={`inline-flex h-12 cursor-pointer items-center justify-center rounded-full border border-border bg-white px-6 text-sm font-semibold text-foreground hover:bg-brand-soft ${
            imageUploading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {imageUploading ? "מעלים את התמונה..." : "בחירת תמונה"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={imageUploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void handleImage(file);
            }}
          />
        </label>
        {imageError ? <p className="text-sm text-brand">{imageError}</p> : null}
        <p className="text-sm text-muted">התמונה תופיע בעמוד האירוע ובהזמנה</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-foreground">סרטון קצר לאורחים</h2>
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            className="h-44 w-full rounded-3xl bg-black object-cover"
          />
        ) : null}
        <label className="inline-flex h-12 cursor-pointer items-center justify-center rounded-full border border-border bg-white px-6 text-sm font-semibold text-foreground hover:bg-brand-soft">
          בחירת סרטון
          <input
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(event) => handleVideo(event.target.files?.[0])}
          />
        </label>
        {videoName ? (
          <p className="text-sm font-medium text-foreground">{videoName}</p>
        ) : null}
        <p className="text-sm text-muted">
          לא חובה — אפשר להוסיף סרטון אישי של עד 30 שניות
        </p>
      </section>

      <label className="flex flex-col gap-2">
        <span className="text-base font-bold text-foreground">כמה מילים לאורחים</span>
        <textarea
          value={message}
          onChange={(event) => {
            const value = event.target.value;
            setMessage(value);
            persistDetails({ message: value });
          }}
          placeholder="אנחנו מתרגשים לחגוג איתכם ונשמח שתהיו חלק מהאירוע שלנו ❤️"
          rows={4}
          className="rounded-3xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand"
        />
      </label>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-foreground">איפה חוגגים?</h2>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">
            שם המקום / האולם
          </span>
          <input
            value={venueName}
            onChange={(event) => {
              const value = event.target.value;
              setVenueName(value);
              persistDetails({ venueName: value });
            }}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">כתובת</span>
          <input
            value={address}
            onChange={(event) => {
              const value = event.target.value;
              setAddress(value);
              persistDetails({ address: value });
            }}
            className={fieldClass}
          />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        {eventDate ? (
          <p className="text-sm text-muted">
            תאריך האירוע: {formatEventDate(eventDate)}
          </p>
        ) : null}
        <label className="flex flex-col gap-2">
          <span className="text-base font-bold text-foreground">שעת האירוע</span>
          <input
            type="time"
            value={eventTime}
            onChange={(event) => {
              const value = event.target.value;
              setEventTime(value);
              persistDetails({ eventTime: value });
            }}
            className={fieldClass}
          />
        </label>
      </section>

      <p className="rounded-3xl bg-brand-soft px-4 py-4 text-sm leading-relaxed text-foreground">
        האירוע שלכם פרטי.
        <br />
        רק אורחים שיקבלו את הקישור לאירוע יוכלו להיכנס אליו.
      </p>

      <button
        type="submit"
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        ממשיכים להזמנת האורחים
      </button>
    </form>
  );
}
