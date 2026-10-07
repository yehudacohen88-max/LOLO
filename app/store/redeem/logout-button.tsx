"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StoreLogoutButton() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function logout() {
    setSaving(true);
    try {
      await fetch("/api/store/logout", { method: "POST" });
      router.push("/store");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={saving}
      className="text-sm font-semibold text-muted hover:text-foreground disabled:opacity-60"
    >
      יציאה
    </button>
  );
}
