import type { ReactNode, Ref } from "react";
import styles from "./host-experience.module.css";

const buttonClass =
  "inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-full border border-border bg-white px-3 text-sm font-semibold text-foreground hover:bg-brand-soft disabled:opacity-60";

type UploadActionsProps = {
  hasImage: boolean;
  uploading: boolean;
  error: ReactNode;
  retryable: boolean;
  onPick: () => void;
  onRetry: () => void;
  onRemove: () => void;
  pickRef: Ref<HTMLButtonElement>;
};

export default function UploadActions({
  hasImage,
  uploading,
  error,
  retryable,
  onPick,
  onRetry,
  onRemove,
  pickRef,
}: UploadActionsProps) {
  const failed = Boolean(error);
  const showRetry = failed && retryable && !uploading;
  const pickLabel = uploading
    ? "מעלים את התמונה..."
    : failed
      ? hasImage && retryable
        ? "החלפת תמונה"
        : "בחירת קובץ אחר"
      : hasImage
        ? "החלפת תמונה"
        : "בחירת תמונה";
  const showRemove = hasImage && (!failed || !retryable);
  const paired = showRetry || showRemove;

  return (
    <div className="flex flex-col gap-2">
      <div className={paired ? styles.uploadPair : styles.uploadSingle}>
        {showRetry ? (
          <button type="button" onClick={onRetry} className={buttonClass}>
            נסו שוב
          </button>
        ) : null}
        <button
          ref={pickRef}
          type="button"
          onClick={() => {
            if (!uploading) {
              onPick();
            }
          }}
          className={`${buttonClass} ${uploading ? "opacity-60" : ""}`}
        >
          {pickLabel}
        </button>
        {showRemove ? (
          <button type="button" onClick={onRemove} className={buttonClass}>
            הסרת תמונה
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-base font-semibold text-brand">
          {error}
        </p>
      ) : null}
    </div>
  );
}
