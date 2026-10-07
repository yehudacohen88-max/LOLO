"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import GiftMedia from "@/components/gift-media";
import { findDraftGift, upsertDraftGift, type DraftGiftSource } from "@/lib/draft-gifts";
import { saveEventDraft } from "@/lib/event-draft";
import { formatPrice, getGiftById } from "@/lib/gifts";
import { ImagePrepareError } from "@/lib/images/prepare";
import { uploadImageFile } from "@/lib/images/upload-client";
import {
  fetchActiveStoreOptions,
  type ActiveStoreOption,
} from "@/lib/stores/active-stores-client";
import { useIsClient } from "@/lib/use-is-client";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

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
  const [error, setError] = useState("");

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
        setStores(nextStores);
        if (nextStores.length === 0) {
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

    setError("");
    setUploading(true);
    try {
      const url = await uploadImageFile(file, "gift");
      setImageUrl(url);
    } catch (uploadError) {
      setError(
        uploadError instanceof ImagePrepareError
          ? uploadError.message
          : "העלאת התמונה נכשלה. נסו שוב.",
      );
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) {
      return;
    }

    const trimmedTitle = title.trim();
    const amount = Number(target.replace(/[^\d.]/g, ""));
    if (!trimmedTitle) {
      setError("נא למלא שם למתנה.");
      return;
    }
    if (trimmedTitle.length > 80) {
      setError("השם ארוך מדי.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("נא להזין יעד גדול מ־0.");
      return;
    }
    if (amount > 10_000_000) {
      setError("היעד גבוה מדי.");
      return;
    }

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
      setError("לא הצלחנו לשמור את המתנה. בדקו את השם ואת היעד.");
      return;
    }

    saveEventDraft({
      giftMode: "catalog",
      moneyAmounts: [],
      allowCustomAmount: true,
      moneyDisplay: "amounts",
    });
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
        <label
          className={`inline-flex h-12 cursor-pointer items-center justify-center rounded-full border border-border bg-white px-6 text-sm font-semibold text-foreground hover:bg-brand-soft ${
            uploading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {uploading ? "מעלים את התמונה..." : imageUrl ? "החלפת תמונה" : "בחירת תמונה"}
          <input
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
        </label>
        {imageUrl ? (
          <button
            type="button"
            onClick={() => setImageUrl("")}
            className="text-sm font-semibold text-brand"
          >
            הסרת תמונה
          </button>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            מומלץ להוסיף תמונה. אפשר גם להמשיך בלי, ואז תופיע מסגרת עם סמל מתנה.
          </p>
        )}
      </section>

      <label className="flex flex-col gap-2">
        <span className="text-base font-bold text-foreground">שם המתנה</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="ערכת LEGO"
          required
          maxLength={80}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-base font-bold text-foreground">יעד</span>
        <div className="flex h-12 items-center rounded-2xl border border-border bg-white px-4 focus-within:border-brand">
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            inputMode="decimal"
            placeholder="1200"
            required
            aria-label="יעד בשקלים"
            className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted/70"
          />
          <span className="mr-2 text-sm font-semibold text-muted">₪</span>
        </div>
        {amountLabel ? (
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

      {error ? <p className="text-center text-sm text-brand">{error}</p> : null}

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
