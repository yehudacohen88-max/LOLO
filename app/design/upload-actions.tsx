import type { Ref } from "react";
import styles from "./host-experience.module.css";

const buttonClass =
  "inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-white px-3 text-sm font-semibold text-foreground hover:bg-brand-soft disabled:opacity-60";

type UploadActionsProps = {
  hasImage: boolean;
  uploading: boolean;
  error: string;
  onPick: () => void;
  onRetry: () => void;
  onRemove: () => void;
  pickRef: Ref<HTMLButtonElement>;
};

export default function UploadActions({
  hasImage,
  uploading,
  error,
  onPick,
  onRetry,
  onRemove,
  pickRef,
}: UploadActionsProps) {
  const showTools = hasImage || Boolean(error);

  return (
    <div className="flex flex-col gap-2">
      <div className={showTools ? styles.uploadGridWide : styles.uploadGrid}>
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
          {uploading ? "מעלים את התמונה..." : showTools ? "החלפת תמונה" : "בחירת תמונה"}
        </button>
        {error && !uploading ? (
          <button type="button" onClick={onRetry} className={buttonClass}>
            נסו שוב
          </button>
        ) : null}
        {showTools ? (
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
