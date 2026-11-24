import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { DOCUMENT_KIND_LABELS, DOCUMENT_STATUS_LABELS } from "@/lib/invoices/labels";
import { loadDocumentSettings, listDocuments } from "@/lib/invoices/repository";
import type { DocumentSettings, StoredDocument } from "@/lib/invoices/types";
import { CHANNEL_LABELS, EVENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/notifications/labels";
import { listNotificationMessages } from "@/lib/notifications/repository";
import type { NotificationMessage } from "@/lib/notifications/types";

export const metadata: Metadata = {
  title: "הודעות ומסמכים | LOLO",
};

export const dynamic = "force-dynamic";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

function missingSettings(settings: DocumentSettings) {
  const missing: string[] = [];
  if (settings.vatRatePercent == null) {
    missing.push("שיעור מע״מ");
  }
  if (settings.vatIncluded == null) {
    missing.push("האם המחיר כולל מע״מ");
  }
  if (settings.documentKind == null) {
    missing.push("סוג המסמך");
  }
  if (settings.currency == null) {
    missing.push("מטבע");
  }
  return missing;
}

export default async function AdminNotificationsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  let messages: NotificationMessage[] = [];
  let documents: StoredDocument[] = [];
  let settings: DocumentSettings | null = null;
  let loadError = "";

  try {
    [messages, documents, settings] = await Promise.all([
      listNotificationMessages({ limit: 50 }),
      listDocuments({ limit: 50 }),
      loadDocumentSettings(),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "טעינת היומן נכשלה.";
  }

  const missing = settings ? missingSettings(settings) : [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground sm:text-4xl">הודעות ומסמכים</h1>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted">
          יומן שליחה ומסמכי בדיקה. הספקים המחוברים הם הדגמה בלבד: לא נשלחת הודעה אמיתית, ולא מופק
          מסמך חשבונאי.
        </p>
      </header>

      {loadError ? <p className="mt-6 text-sm text-brand">{loadError}</p> : null}
      {missing.length > 0 ? (
        <p className="mt-6 text-sm text-brand">
          עדיין לא הוגדר: {missing.join(", ")}. לא מופק מסמך עד שההגדרות נשמרות.
        </p>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-bold">יומן הודעות</h2>
        {!loadError && messages.length === 0 ? (
          <p className="mt-4 text-base text-muted">אין הודעות ביומן.</p>
        ) : null}
        <ul className="mt-4 flex flex-col gap-3">
          {messages.map((message) => (
            <li key={message.id} className="rounded-3xl border border-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-foreground">{EVENT_TYPE_LABELS[message.eventType]}</p>
                  <p className="mt-1 text-sm text-muted" dir="ltr">
                    {message.recipient}
                  </p>
                </div>
                <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                  {STATUS_LABELS[message.status]} · {CHANNEL_LABELS[message.channel]}
                </span>
              </div>
              {message.subject ? <p className="mt-3 text-sm font-semibold">{message.subject}</p> : null}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {message.body}
              </p>
              {message.error ? <p className="mt-2 text-sm text-brand">{message.error}</p> : null}
              <p className="mt-3 text-xs text-muted">
                {formatWhen(message.createdAt)} · {message.provider}
                {message.simulated ? " · הדגמה" : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold">מסמכים</h2>
        {!loadError && documents.length === 0 ? (
          <p className="mt-4 text-base text-muted">אין מסמכים שמורים.</p>
        ) : null}
        <ul className="mt-4 flex flex-col gap-3">
          {documents.map((document) => (
            <li key={document.id} className="rounded-3xl border border-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-foreground">{DOCUMENT_KIND_LABELS[document.kind]}</p>
                  <p className="mt-1 text-sm text-muted" dir="ltr">
                    {document.orderRef}
                  </p>
                </div>
                <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                  {DOCUMENT_STATUS_LABELS[document.status]}
                  {document.simulated ? " · מסמך בדיקה" : ""}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {document.watermark}
              </p>
              <p className="mt-3 text-xs text-muted">
                {formatWhen(document.createdAt)} · {document.provider} · {document.currency}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
