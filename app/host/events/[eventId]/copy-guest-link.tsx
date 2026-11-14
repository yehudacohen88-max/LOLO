"use client";

import { useState } from "react";
import styles from "@/app/design/bold-host.module.css";

type CopyGuestLinkProps = {
  guestUrl: string;
  eventTitle?: string;
  disabled?: boolean;
};

export default function CopyGuestLink({
  guestUrl,
  eventTitle = "",
  disabled = false,
}: CopyGuestLinkProps) {
  const [toast, setToast] = useState("");
  const title = eventTitle.trim() || "האירוע";
  const whatsappHref = guestUrl
    ? `https://api.whatsapp.com/send?text=${encodeURIComponent(
        [`לפרטי האירוע ולבחירת מתנה ב-LOLO:`, guestUrl, "", title].join("\n"),
      )}`
    : "";

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
      <div className={styles.shareRow}>
        <button type="button" onClick={copyLink} disabled={disabled} className={styles.primary}>
          העתקת קישור
        </button>
        {whatsappHref && !disabled ? (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={styles.secondary}>
            שיתוף ב-WhatsApp
          </a>
        ) : null}
        {whatsappHref && disabled ? (
          <span className={styles.secondary}>שיתוף ב-WhatsApp</span>
        ) : null}
      </div>
    </div>
  );
}
