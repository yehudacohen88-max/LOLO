"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ImageFormatHint from "@/app/design/image-format-hint";
import ResolvedPhoto from "@/app/design/resolved-photo";
import UploadActions from "@/app/design/upload-actions";
import { describeImageUploadError, type UploadFailure } from "@/app/design/upload-error";
import GiftMedia from "@/components/gift-media";
import { resolveEventCover, resolveGiftImage } from "@/lib/image-library";
import { uploadImageFile } from "@/lib/images/upload-client";

type HostPhotoEditorProps = {
  eventId: string;
  giftId?: string;
  initialUrl: string;
  eventType?: string;
  title: string;
  description?: string;
  disabled?: boolean;
  previewOnly?: boolean;
  compact?: boolean;
};

export default function HostPhotoEditor({
  eventId,
  giftId,
  initialUrl,
  eventType = "",
  title,
  description = "",
  disabled = false,
  previewOnly = false,
  compact = false,
}: HostPhotoEditorProps) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(initialUrl);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<UploadFailure | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const localPreview = useRef("");

  const shown = previewUrl || imageUrl;
  const visual = giftId
    ? resolveGiftImage({
        hostImageUrl: shown,
        title: title || "מתנה",
        description,
        alt: title || "המתנה",
      })
    : resolveEventCover({
        hostImageUrl: shown,
        eventType,
        title,
        alt: shown ? title || "תמונת האירוע" : undefined,
      });
  const backup = giftId
    ? resolveGiftImage({ hostImageUrl: "", title: title || "מתנה", description })
    : resolveEventCover({ hostImageUrl: "", eventType, title });

  function releasePreview() {
    if (localPreview.current) {
      URL.revokeObjectURL(localPreview.current);
      localPreview.current = "";
    }
  }

  async function persist(nextUrl: string) {
    const response = await fetch(`/api/host/events/${encodeURIComponent(eventId)}/images`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(giftId ? { giftId, imageUrl: nextUrl } : { imageUrl: nextUrl }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; imageUrl?: string };
    if (!response.ok) {
      throw new Error(payload.error || "שמירת התמונה נכשלה.");
    }
    setImageUrl(typeof payload.imageUrl === "string" ? payload.imageUrl : nextUrl);
    setPreviewUrl("");
    router.refresh();
  }

  async function handleImage(file?: File) {
    if (!file || uploading || disabled) {
      return;
    }
    setError(null);
    releasePreview();
    if (previewOnly) {
      const localUrl = URL.createObjectURL(file);
      localPreview.current = localUrl;
      setPreviewUrl(localUrl);
      setImageUrl(localUrl);
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadImageFile(file, giftId ? "gift" : "cover");
      await persist(uploaded);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error && uploadError.name !== "ImagePrepareError"
          ? { message: uploadError.message, retryable: true, unsupported: false }
          : describeImageUploadError(file, uploadError),
      );
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    if (disabled || uploading) {
      return;
    }
    setError(null);
    releasePreview();
    if (previewOnly) {
      setPreviewUrl("");
      setImageUrl("");
      return;
    }
    setUploading(true);
    try {
      await persist("");
    } catch (removeError) {
      setError({
        message: removeError instanceof Error ? removeError.message : "שמירת התמונה נכשלה.",
        retryable: false,
        unsupported: false,
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ResolvedPhoto
        visual={visual}
        backup={backup}
        ratio={giftId ? "card" : "cover"}
        compact={compact}
        fallback={<GiftMedia icon="🎁" alt="" className={compact ? "h-16 w-16 text-2xl" : "h-36 w-full text-4xl"} />}
      />
      {disabled ? null : (
        <>
          <UploadActions
            hasImage={Boolean(shown)}
            uploading={uploading}
            error={error?.message ?? null}
            retryable={error?.retryable ?? false}
            onPick={() => inputRef.current?.click()}
            onRetry={() => inputRef.current?.click()}
            onRemove={() => {
              void removeImage();
            }}
            pickRef={actionRef}
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            aria-label={giftId ? "העלאת תמונת מתנה" : "העלאת תמונת כיסוי"}
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void handleImage(file);
            }}
          />
          <ImageFormatHint
            lead={
              shown
                ? "התמונה שלכם מוצגת. הסרת התמונה מחזירה את ברירת המחדל."
                : "מוצגת תמונת ברירת מחדל. אפשר להחליף אותה."
            }
          />
        </>
      )}
    </div>
  );
}
