import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { LEGAL_DOCUMENTS, legalSurface } from "../lib/legal/documents";
import {
  LEGAL_DRAFTS_FLAG,
  legalDraftPathHidden,
  legalDraftsEnabled,
  legalDraftsEnabledFromEnv,
} from "../lib/legal/flag";
import { legalMarkdownFiles } from "../lib/legal/markdown";
import { BUSINESS_DECISION, LEGAL_REVIEW } from "../lib/legal/markers";
import { LEGAL_PRIVACY_PATH, legalCollectionNotice } from "../lib/legal/notices";

const root = path.resolve(import.meta.dirname, "..");

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function combinedDraftText() {
  return legalMarkdownFiles().map((file) => file.body).join("\n");
}

describe("legal draft flag", () => {
  it("stays off unless the value is an explicit on switch", () => {
    for (const raw of [undefined, null, "", "false", "0", "off", "no", "enabled", "yes-please"]) {
      assert.equal(legalDraftsEnabled(raw), false, String(raw));
    }
    for (const raw of ["1", "true", "TRUE", " yes ", "on", "ON"]) {
      assert.equal(legalDraftsEnabled(raw), true, raw);
    }
  });

  it("reads only LEGAL_DRAFTS_ENABLED and defaults off when that key is absent", () => {
    assert.equal(legalDraftsEnabledFromEnv({}), false);
    assert.equal(legalDraftsEnabledFromEnv({ LEGAL_DRAFTS_ENABLED: "" }), false);
    assert.equal(legalDraftsEnabledFromEnv({ LEGAL_DRAFTS_ENABLED: "false" }), false);
    assert.equal(legalDraftsEnabledFromEnv({ NODE_ENV: "production" }), false);
    assert.equal(legalDraftsEnabledFromEnv({ [LEGAL_DRAFTS_FLAG]: "1" }), true);
  });

  it("hides every legal route when the flag is off and shows a known document when it is on", () => {
    assert.equal(legalSurface(false), "hidden");
    assert.equal(legalSurface(false, "privacy"), "hidden");
    assert.equal(legalSurface(false, "not-a-document"), "hidden");
    assert.equal(legalSurface(true), "index");
    assert.equal(legalSurface(true, "privacy"), "document");
    assert.equal(legalSurface(true, "terms"), "document");
    assert.equal(legalSurface(true, "pilot"), "document");
    assert.equal(legalSurface(true, "retention"), "document");
    assert.equal(legalSurface(true, "rights"), "document");
    assert.equal(legalSurface(true, "secret"), "missing");
    assert.equal(LEGAL_DOCUMENTS.length, 5);
  });

  it("hides /legal in the proxy when the flag is off and leaves other paths alone", () => {
    assert.equal(legalDraftPathHidden("/legal", false), true);
    assert.equal(legalDraftPathHidden("/legal/", false), true);
    assert.equal(legalDraftPathHidden("/legal/privacy", false), true);
    assert.equal(legalDraftPathHidden("/legal/privacy", true), false);
    assert.equal(legalDraftPathHidden("/e/demo-event/details", false), false);
    assert.equal(legalDraftPathHidden("/", false), false);
    assert.match(read("proxy.ts"), /legalDraftPathHidden/);
  });
});

describe("legal collection notices", () => {
  it("renders nothing while the flag is off", () => {
    assert.equal(legalCollectionNotice("guest", false), null);
    assert.equal(legalCollectionNotice("host", false), null);
  });

  it("shows the guest notice and the host consent notice when the flag is on", () => {
    const guest = legalCollectionNotice("guest", true);
    const host = legalCollectionNotice("host", true);
    assert.ok(guest);
    assert.ok(host);
    assert.equal(guest.href, LEGAL_PRIVACY_PATH);
    assert.equal(host.href, LEGAL_PRIVACY_PATH);
    assert.match(guest.text, /שם/);
    assert.match(guest.text, /טלפון/);
    assert.match(guest.text, /אימייל/);
    assert.match(guest.text, /אין שליחת אימייל או מסרון/);
    assert.equal(guest.marker, null);
    assert.match(host.text, /הסכמה/);
    assert.match(host.text, /בסיס חוקי אחר/);
    assert.equal(host.marker, LEGAL_REVIEW);
  });
});

describe("legal draft text", () => {
  it("matches the markdown files checked in for review", () => {
    for (const file of legalMarkdownFiles()) {
      assert.equal(read(file.path), file.body, file.path);
    }
  });

  it("keeps placeholders and review markers, and does not invent a contact email", () => {
    const text = combinedDraftText();
    assert.match(text, /\[להשלמה: שם הישות המשפטית\]/);
    assert.match(text, /\[להשלמה: ערוץ פנייה מאושר, בלי כתובת דוא״ל\]/);
    assert.match(text, /\[להשלמה: אזור אירוח Vercel\]/);
    assert.match(text, /\[להשלמה: אזור פרויקט Supabase\]/);
    assert.match(text, /תיקון מס׳ 13/);
    assert.match(text, /gift-images/);
    assert.match(text, /אינו בעל ערך כספי/);
    assert.match(text, /לא מועבר כסף למארח/);
    assert.match(text, /לא מועבר כסף לבית עסק/);
    assert.doesNotMatch(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    assert.doesNotMatch(text, /חברת LOLO/);
    assert.ok(text.includes(BUSINESS_DECISION));
    assert.ok(text.includes(LEGAL_REVIEW));
    for (const doc of LEGAL_DOCUMENTS) {
      const body = legalMarkdownFiles().find((file) => file.path.endsWith(doc.file))?.body ?? "";
      assert.ok(body.includes(BUSINESS_DECISION) || body.includes(LEGAL_REVIEW), doc.slug);
    }
  });

  it("describes the cookie lifetimes that the session code actually sets", () => {
    const text = combinedDraftText();
    assert.match(read("lib/host/session.ts"), /const SESSION_HOURS = 12/);
    assert.match(read("lib/admin/session.ts"), /const SESSION_HOURS = 12/);
    assert.match(read("lib/store/session.ts"), /const SESSION_HOURS = 12/);
    assert.match(read("lib/invite/session.ts"), /const SESSION_DAYS = 30/);
    assert.match(read("lib/beta/gate.ts"), /30 \* 24 \* 60 \* 60 \* 1000/);
    assert.match(text, /12 שעות/);
    assert.match(text, /30 יום/);
    assert.match(text, /lolo_invite_session/);
    assert.match(text, /lolo_beta_attempts/);
  });
});

describe("legal draft wiring", () => {
  it("gates the routes and leaves the form notices off unless a prop turns them on", () => {
    const layout = read("app/legal/layout.tsx");
    assert.match(layout, /legalDraftsEnabledFromEnv/);
    assert.match(layout, /notFound/);
    assert.match(layout, /index: false/);
    assert.match(read("next.config.ts"), /X-Robots-Tag/);

    for (const file of [
      "app/e/[slug]/details/guest-details-form.tsx",
      "app/create-event/guests/guests-form.tsx",
      "app/host/events/[eventId]/host-guest-list.tsx",
    ]) {
      const source = read(file);
      assert.match(source, /LegalCollectionNotice/);
      assert.match(source, /legalDrafts = false/);
    }

    assert.match(read("components/legal/collection-notice.tsx"), /if \(!notice\)/);
    assert.doesNotMatch(read("app/page.tsx"), /\/legal/);
  });
});
