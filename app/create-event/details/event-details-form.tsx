"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  DraftStorageError,
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

const actionClass =
  "inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-white px-3 text-sm font-semibold text-foreground hover:bg-brand-soft disabled:opacity-60";

const COVER_BLOCKED =
  "לא הצלחנו לשמור את התמונה. היא גדולה מדי, או שההעלאה לא הושלמה. הסירו אותה או בחרו תמונה אחרת.";
const COVER_UPLOADING = "התמונה עדיין עולה. המתינו רגע, ואז המשיכו.";
const SAVE_FAILED = "לא הצלחנו לשמור את הפרטים. נסו שוב.";

type FocusTarget = "" | "image" | "video" | "form";

function isUnsavedCover(value: string) {
  return value.startsWith("data:") || value.startsWith("blob:");
}

export default function EventDetailsForm() {
  const router = useRouter();
  const isClient = useIsClient();
  const [ready, setReady] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [videoName, setVideoName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [videoError, setVideoError] = useState("");
  const [formError, setFormError] = useState("");
  const [focusRequest, setFocusRequest] = useState(0);
  const focusTargetRef = useRef<FocusTarget>("");
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverActionRef = useRef<HTMLButtonElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoActionRef = useRef<HTMLButtonElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const uploadAttempt = useRef(0);
  const localPreviewRef = useRef("");

  if (isClient && !ready) {
    const draft = loadEventDraft();
    setEventDate(draft.eventDate);
    setImageDataUrl(draft.imageDataUrl);
    setImagePreview(draft.imageDataUrl);
    setVideoName(draft.videoName);
    setVideoUrl(getVideoPreviewUrl());
    setMessage(draft.message);
    setVenueName(draft.venueName);
    setAddress(draft.address);
    setEventTime(draft.eventTime);
    if (draft.imageDataUrl.startsWith("data:")) {
      setImageError(COVER_BLOCKED);
    }
    setReady(true);
  }

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    const target = focusTargetRef.current;
    const node =
      target === "image"
        ? coverActionRef.current
        : target === "video"
          ? videoActionRef.current
          : formErrorRef.current;
    node?.scrollIntoView({ behavior: "auto", block: "center" });
    node?.focus({ preventScroll: true });
  }, [focusRequest]);

  function requestFocus(target: FocusTarget) {
    focusTargetRef.current = target;
    setFocusRequest((count) => count + 1);
  }

  function releaseLocalPreview() {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = "";
    }
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
    focus: boolean,
  ) {
    try {
      saveEventDraft(patch);
      setFormError("");
      return true;
    } catch (error) {
      const messageText = error instanceof DraftStorageError ? error.message : SAVE_FAILED;
      const imageProblem =
        typeof patch.imageDataUrl === "string" &&
        (isUnsavedCover(patch.imageDataUrl) || patch.imageDataUrl.length > 2000);
      if (imageProblem) {
        setImageError(messageText);
        if (focus) {
          requestFocus("image");
        }
      } else if (Object.keys(patch).length === 1 && typeof patch.videoName === "string") {
        setVideoError(messageText);
        if (focus) {
          requestFocus("video");
        }
      } else {
        setFormError(messageText);
        if (focus) {
          requestFocus("form");
        }
      }
      return false;
    }
  }

  async function handleImage(file?: File) {
    if (!file || imageUploading) {
      return;
    }

    const attempt = uploadAttempt.current + 1;
    uploadAttempt.current = attempt;
    setImageError("");
    setFormError("");
    releaseLocalPreview();
    const localUrl = URL.createObjectURL(file);
    localPreviewRef.current = localUrl;
    setImagePreview(localUrl);
    setImageUploading(true);

    try {
      const url = await uploadImageFile(file, "cover");
      if (uploadAttempt.current !== attempt) {
        return;
      }
      releaseLocalPreview();
      setImageDataUrl(url);
      setImagePreview(url);
      const saved = persistDetails({ imageDataUrl: url }, true);
      if (!saved) {
        setImageDataUrl("");
        setImagePreview("");
      }
    } catch (error) {
      if (uploadAttempt.current !== attempt) {
        return;
      }
      releaseLocalPreview();
      setImagePreview(imageDataUrl);
      setImageError(
        error instanceof ImagePrepareError ? error.message : "העלאת התמונה נכשלה. נסו שוב.",
      );
      requestFocus("image");
    } finally {
      if (uploadAttempt.current === attempt) {
        setImageUploading(false);
      }
    }
  }

  function removeImage() {
    uploadAttempt.current += 1;
    releaseLocalPreview();
    setImageUploading(false);
    setImageDataUrl("");
    setImagePreview("");
    setImageError("");
    persistDetails({ imageDataUrl: "" }, false);
  }

  function handleVideo(file?: File) {
    if (!file) {
      return;
    }

    setVideoError("");
    setVideoName(file.name);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoPreviewUrl(url);
    persistDetails({ videoName: file.name }, false);
  }

  function removeVideo() {
    setVideoName("");
    setVideoUrl("");
    setVideoPreviewUrl("");
    setVideoError("");
    persistDetails({ videoName: "" }, false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (imageUploading) {
      setImageError(COVER_UPLOADING);
      requestFocus("image");
      return;
    }

    if (isUnsavedCover(imageDataUrl) || isUnsavedCover(imagePreview)) {
      setImageError(COVER_BLOCKED);
      requestFocus("image");
      persistDetails(
        {
          videoName,
          message,
          venueName,
          address,
          eventTime,
        },
        false,
      );
      return;
    }

    setVideoPreviewUrl(videoUrl);
    const saved = persistDetails(
      {
        imageDataUrl,
        videoName,
        message,
        venueName,
        address,
        eventTime,
      },
      true,
    );
    if (!saved) {
      return;
    }
    router.push("/create-event/guests");
  }

  if (!ready) {
    return null;
  }

  const displayImage = imagePreview || imageDataUrl;
  const hasVideo = Boolean(videoUrl || videoName);

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-foreground">תמונה לאירוע</h2>
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImage}
            alt="תצוגה מקדימה של תמונת האירוע"
            className="h-44 w-full rounded-3xl object-cover"
          />
        ) : (
          <div className="flex h-44 items-center justify-center rounded-3xl border border-dashed border-border bg-white text-sm text-muted">
            עדיין לא נבחרה תמונה
          </div>
        )}
        <div className={displayImage ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"}>
          <button
            ref={coverActionRef}
            type="button"
            onClick={() => {
              if (!imageUploading) {
                coverInputRef.current?.click();
              }
            }}
            className={`${actionClass} ${imageUploading ? "opacity-60" : ""}`}
          >
            {imageUploading
              ? "מעלים את התמונה..."
              : displayImage
                ? "החלפת תמונה"
                : "בחירת תמונה"}
          </button>
          {displayImage ? (
            <button type="button" onClick={removeImage} className={actionClass}>
              הסרת תמונה
            </button>
          ) : null}
        </div>
        <input
          ref={coverInputRef}
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
        {imageError ? (
          <p role="alert" className="text-sm font-medium text-brand">
            {imageError}
          </p>
        ) : null}
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
        <div className={hasVideo ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"}>
          <button
            ref={videoActionRef}
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className={actionClass}
          >
            {hasVideo ? "החלפת סרטון" : "בחירת סרטון"}
          </button>
          {hasVideo ? (
            <button type="button" onClick={removeVideo} className={actionClass}>
              הסרת סרטון
            </button>
          ) : null}
        </div>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            handleVideo(file);
          }}
        />
        {videoName ? <p className="text-sm font-medium text-foreground">{videoName}</p> : null}
        {videoError ? (
          <p role="alert" className="text-sm font-medium text-brand">
            {videoError}
          </p>
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
            persistDetails({ message: value }, false);
          }}
          placeholder="אנחנו מתרגשים לחגוג איתכם ונשמח שתהיו חלק מהאירוע שלנו ❤️"
          rows={4}
          className="rounded-3xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand"
        />
      </label>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-foreground">איפה חוגגים?</h2>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">שם המקום / האולם</span>
          <input
            value={venueName}
            onChange={(event) => {
              const value = event.target.value;
              setVenueName(value);
              persistDetails({ venueName: value }, false);
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
              persistDetails({ address: value }, false);
            }}
            className={fieldClass}
          />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        {eventDate ? (
          <p className="text-sm text-muted">תאריך האירוע: {formatEventDate(eventDate)}</p>
        ) : null}
        <label className="flex flex-col gap-2">
          <span className="text-base font-bold text-foreground">שעת האירוע</span>
          <input
            type="time"
            value={eventTime}
            onChange={(event) => {
              const value = event.target.value;
              setEventTime(value);
              persistDetails({ eventTime: value }, false);
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

      {formError ? (
        <p
          ref={formErrorRef}
          tabIndex={-1}
          role="alert"
          className="text-sm font-medium text-brand outline-none focus:outline focus:outline-2 focus:outline-offset-[3px] focus:outline-brand"
        >
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        ממשיכים להזמנת האורחים
      </button>
    </form>
  );
}
