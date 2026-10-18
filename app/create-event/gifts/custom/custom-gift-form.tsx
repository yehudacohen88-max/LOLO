"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import UploadActions from "@/app/design/upload-actions";
import { describeImageUploadError, type UploadFailure } from "@/app/design/upload-error";
import { userFacingMessage } from "@/app/design/user-error";
import { visibleHostStores } from "@/app/design/host-stores";
import GiftMedia from "@/components/gift-media";
import { findDraftGift, upsertDraftGift, type DraftGiftSource } from "@/lib/draft-gifts";
import { saveEventDraft } from "@/lib/event-draft";
import { formatPrice, getGiftById } from "@/lib/gifts";
import { uploadImageFile } from "@/lib/images/upload-client";
import {
  fetchActiveStoreOptions,
  type ActiveStoreOption,
} from "@/lib/stores/active-stores-client";
import { useIsClient } from "@/lib/use-is-client";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

type GiftFocus = "" | "image" | "title" | "target" | "form";

export default function CustomGiftForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isClient = useIsClient();
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [giftId, setGiftId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [icon, setIcon] = useState("🎁");
  const [storeId, setStoreId] = useState("");
  const [source, setSource] = useState<DraftGiftSource>("custom");
  const [stores, setStores] = useState<ActiveStoreOption[]>([]);
  const [storesNote, setStoresNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<UploadFailure | null>(null);
  const [titleError, setTitleError] = useState("");
  const [targetError, setTargetError] = useState("");
  const [formError, setFormError] = useState("");
  const [focusRequest, setFocusRequest] = useState(0);
  const focusTargetRef = useRef<GiftFocus>("");
  const imageActionRef = useRef<HTMLButtonElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const uploadAttempt = useRef(0);
  const lastFileRef = useRef<File | null>(null);

  if (isClient && !ready) {
    const existingId = searchParams.get("id")?.trim() ?? "";
    if (existingId) {
      const existing = findDraftGift(existingId);
      if (!existing) {
        setMissing(true);
      } else {
        setGiftId(existing.id);
        setTitle(existing.title);
        setDescription(existing.description);
        setTarget(String(existing.targetAmount));
        setImageUrl(existing.imageUrl);
        setIcon(existing.icon || "🎁");
        setStoreId(existing.storeId ?? "");
        setSource(existing.source);
      }
    } else {
      const idea = getGiftById(searchParams.get("idea")?.trim() ?? "");
      setGiftId(crypto.randomUUID());
      if (idea) {
        setTitle(idea.name);
        setDescription(idea.description);
        setTarget(String(idea.price));
        setIcon(idea.emoji || "🎁");
        setSource("catalog");
      }
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
        ? imageActionRef.current
        : target === "title"
          ? titleRef.current
          : target === "target"
            ? targetRef.current
            : formErrorRef.current;
    node?.scrollIntoView({ behavior: "auto", block: "center" });
    node?.focus({ preventScroll: true });
  }, [focusRequest]);

  function requestFocus(target: GiftFocus) {
    focusTargetRef.current = target;
    setFocusRequest((count) => count + 1);
  }

  useEffect(() => {
    if (!ready || missing) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const nextStores = await fetchActiveStoreOptions();
        if (cancelled) {
          return;
        }
        const visible = visibleHostStores(nextStores);
        setStores(visible);
        setStoreId((current) => {
          if (!current || visible.some((store) => store.id === current)) {
            return current;
          }
          return nextStores.some((store) => store.id === current) ? "" : current;
        });
        if (visible.length === 0) {
          setStoresNote("אין כרגע חנויות פעילות. אפשר לשמור בלי חנות.");
        }
      } catch {
        if (!cancelled) {
          setStoresNote("לא ניתן לטעון את רשימת החנויות. אפשר לשמור בלי חנות.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, missing]);

  async function handleImage(file?: File) {
    if (!file || uploading) {
      return;
    }

    const attempt = uploadAttempt.current + 1;
    uploadAttempt.current = attempt;
    lastFileRef.current = file;
    setImageError(null);
    setFormError("");
    setUploading(true);
    try {
      const url = await uploadImageFile(file, "gift");
      if (uploadAttempt.current !== attempt) {
        return;
      }
      setImageUrl(url);
    } catch (uploadError) {
      if (uploadAttempt.current !== attempt) {
        return;
      }
      setImageError(describeImageUploadError(file, uploadError));
      requestFocus("image");
    } finally {
      if (uploadAttempt.current === attempt) {
        setUploading(false);
      }
    }
  }

  function removeImage() {
    uploadAttempt.current += 1;
    lastFileRef.current = null;
    setUploading(false);
    setImageUrl("");
    setImageError(null);
  }

  function retryImage() {
    const file = lastFileRef.current;
    if (!file || uploading) {
      return;
    }
    void handleImage(file);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) {
      return;
    }

    const trimmedTitle = title.trim();
    const amount = Number(target.replace(/[^\d.]/g, ""));
    setTitleError("");
    setTargetError("");
    setFormError("");

    if (imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) {
      setImageError({
        retryable: false,
        unsupported: false,
        message:
          "לא הצלחנו לשמור את התמונה. היא גדולה מדי, או שההעלאה לא הושלמה. הסירו אותה או בחרו תמונה אחרת.",
      });
      requestFocus("image");
      return;
    }
    if (!trimmedTitle) {
      setTitleError("נא למלא שם למתנה.");
      requestFocus("title");
      return;
    }
    if (trimmedTitle.length > 80) {
      setTitleError("השם ארוך מדי.");
      requestFocus("title");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setTargetError("נא להזין יעד גדול מ־0.");
      requestFocus("target");
      return;
    }
    if (amount > 10_000_000) {
      setTargetError("היעד גבוה מדי.");
      requestFocus("target");
      return;
    }

    try {
      const saved = upsertDraftGift({
        id: giftId,
        title: trimmedTitle,
        description: description.trim(),
        targetAmount: amount,
        imageUrl,
        icon,
        storeId: storeId || null,
        source,
      });
      if (!saved) {
        setFormError("לא הצלחנו לשמור את המתנה. בדקו את השם ואת היעד.");
        requestFocus("form");
        return;
      }

      saveEventDraft({
        giftMode: "catalog",
        moneyAmounts: [],
        allowCustomAmount: true,
        moneyDisplay: "amounts",
      });
    } catch (error) {
      setFormError(userFacingMessage(error, "לא הצלחנו לשמור את המתנה. נסו שוב."));
      requestFocus("form");
      return;
    }
    router.push("/create-event/gifts/organize");
  }

  if (!ready) {
    return null;
  }

  if (missing) {
    return (
      <div className="mt-10 rounded-3xl border border-border bg-white p-6 text-center">
        <p className="text-base text-muted">המתנה לא נמצאה.</p>
        <Link
          href="/create-event/gifts/organize"
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          חזרה למתנות
        </Link>
      </div>
    );
  }

  const amountValue = Number(target.replace(/[^\d.]/g, ""));
  const amountLabel =
    Number.isFinite(amountValue) && amountValue > 0 ? formatPrice(amountValue) : "";

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-foreground">תמונה</h2>
        <GiftMedia
          imageUrl={imageUrl}
          icon={icon}
          alt={title ? `תמונת ${title}` : "תצוגה מקדימה של המתנה"}
          className="h-48 w-full text-5xl"
        />
        <UploadActions
          hasImage={Boolean(imageUrl)}
          uploading={uploading}
          error={imageError?.message ?? null}
          retryable={imageError?.retryable ?? false}
          onPick={() => imageInputRef.current?.click()}
          onRetry={retryImage}
          onRemove={removeImage}
          pickRef={imageActionRef}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void handleImage(file);
          }}
        />
        {imageUrl ? null : (
          <p className="text-sm leading-relaxed text-muted">
            מומלץ להוסיף תמונה. אפשר גם להמשיך בלי, ואז תופיע מסגרת עם סמל מתנה.
          </p>
        )}
      </section>

      <label className="flex flex-col gap-2">
        <span className="text-base font-bold text-foreground">שם המתנה</span>
        <input
          ref={titleRef}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleError("");
          }}
          placeholder="ערכת LEGO"
          dir="auto"
          maxLength={80}
          aria-invalid={titleError ? true : undefined}
          className={fieldClass}
        />
        {titleError ? (
          <span role="alert" className="text-sm font-medium text-brand">
            {titleError}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-base font-bold text-foreground">יעד</span>
        <div className="flex h-12 items-center rounded-2xl border border-border bg-white px-4 focus-within:border-brand">
          <input
            ref={targetRef}
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
              setTargetError("");
            }}
            inputMode="decimal"
            placeholder="1200"
            aria-label="יעד בשקלים"
            aria-invalid={targetError ? true : undefined}
            className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted/70"
          />
          <span className="mr-2 text-sm font-semibold text-muted">₪</span>
        </div>
        {targetError ? (
          <span role="alert" className="text-sm font-medium text-brand">
            {targetError}
          </span>
        ) : amountLabel ? (
          <span className="text-sm font-semibold text-brand">יעד: {amountLabel}</span>
        ) : null}
        <span className="text-sm leading-relaxed text-muted">
          היעד הוא מטרה. האורחים יכולים להשתתף בכל סכום.
        </span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-base font-bold text-foreground">חנות</span>
        <select
          value={storeId}
          onChange={(event) => setStoreId(event.target.value)}
          className={fieldClass}
        >
          <option value="">בלי חנות</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
        {storesNote ? <span className="text-sm text-muted">{storesNote}</span> : null}
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-base font-bold text-foreground">תיאור</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="למשל: הערכה הגדולה, בדיוק כמו שרציתם"
          rows={3}
          maxLength={400}
          className="rounded-3xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand"
        />
      </label>

      {formError ? (
        <p
          ref={formErrorRef}
          tabIndex={-1}
          role="alert"
          className="text-center text-sm font-medium text-brand outline-none focus:outline focus:outline-2 focus:outline-offset-[3px] focus:outline-brand"
        >
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={uploading}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand/40"
      >
        שמירת המתנה
      </button>
      <Link
        href="/create-event/gifts/organize"
        className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground transition-colors hover:bg-brand-soft"
      >
        ביטול
      </Link>
    </form>
  );
}
