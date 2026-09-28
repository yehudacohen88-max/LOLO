"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { guestEventPath } from "@/lib/events";
import { fromRouteParam } from "@/lib/events/slug";
import {
  isValidEmail,
  isValidPhone,
  loadGuestDetails,
  saveGuestDetails,
} from "@/lib/guest-draft";
import { savePendingGuestOrder } from "@/lib/orders/client";

const fieldClass =
  "h-12 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-brand";

export default function GuestDetailsForm() {
  const router = useRouter();
  const slug = fromRouteParam(useParams<{ slug: string }>().slug);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [wantReceipt, setWantReceipt] = useState(true);
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
  }>({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!slug) {
        return;
      }

      const details = loadGuestDetails(slug);
      if (cancelled) {
        return;
      }

      let name = details.name;
      let phone = details.phone;
      if (!name || !phone) {
        try {
          const response = await fetch(
            `/api/invite/identity?slug=${encodeURIComponent(slug)}`,
          );
          if (response.ok) {
            const invite = (await response.json()) as {
              name?: string;
              phone?: string;
            };
            name = name || invite.name || "";
            phone = phone || invite.phone || "";
          }
        } catch {
          // Keep local draft values.
        }
      }

      if (cancelled) {
        return;
      }

      setName(name);
      setPhone(phone);
      setEmail(details.email);
      setWantReceipt(details.wantReceipt);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!ready) {
    return null;
  }

  return (
    <form
      className="mt-10 flex flex-col gap-5"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const nextErrors: typeof errors = {};

        if (!name.trim()) {
          nextErrors.name = "נא להזין שם מלא";
        }
        if (!isValidPhone(phone)) {
          nextErrors.phone = "נא להזין מספר טלפון תקין";
        }
        if (!isValidEmail(email)) {
          nextErrors.email = "נא להזין כתובת אימייל תקינה";
        }

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
          return;
        }

        saveGuestDetails(slug, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          wantReceipt,
        });

        try {
          setSaving(true);
          setSaveError("");
          await savePendingGuestOrder(slug);
          router.push(guestEventPath(slug, "payment"));
        } catch (error) {
          setSaveError(
            error instanceof Error ? error.message : "שמירת ההזמנה נכשלה.",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">שם מלא</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={fieldClass}
        />
        {errors.name ? (
          <span className="text-sm text-brand">{errors.name}</span>
        ) : null}
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">מספר טלפון</span>
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className={fieldClass}
        />
        {errors.phone ? (
          <span className="text-sm text-brand">{errors.phone}</span>
        ) : null}
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">אימייל</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
        />
        {errors.email ? (
          <span className="text-sm text-brand">{errors.email}</span>
        ) : null}
      </label>
      <label className="flex items-center gap-3 rounded-3xl border border-border bg-white px-4 py-4">
        <input
          type="checkbox"
          checked={wantReceipt}
          onChange={(event) => setWantReceipt(event.target.checked)}
          className="h-5 w-5 accent-brand"
        />
        <span className="text-sm font-semibold text-foreground">
          אני רוצה לקבל אישור על המתנה
        </span>
      </label>
      {saveError ? (
        <p className="text-center text-sm text-brand">{saveError}</p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand/40"
      >
        מעבר לתשלום
      </button>
    </form>
  );
}
