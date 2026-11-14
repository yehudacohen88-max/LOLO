"use client";

import { useState } from "react";
import styles from "@/app/design/bold-host.module.css";

type CopyGuestLinkProps = {
  guestUrl: string;
  disabled?: boolean;
};

export default function CopyGuestLink({ guestUrl, disabled = false }: CopyGuestLinkProps) {
  const [toast, setToast] = useState("");

  async function copyLink() {
    if (!guestUrl) {
      return;
    }

    await navigator.clipboard.writeText(guestUrl);
    setToast("הקישור הועתק");
    window.setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className={styles.share}>
      {toast ? (
        <p className={styles.toast} role="status">
          {toast}
        </p>
      ) : null}
      <p dir="ltr" className={styles.url}>
        {guestUrl}
      </p>
      <button
        type="button"
        onClick={copyLink}
        disabled={disabled}
        className={`${styles.primary} ${styles.inline}`}
      >
        העתקת קישור
      </button>
    </div>
  );
}
