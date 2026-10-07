"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function logout() {
    setSaving(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
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
