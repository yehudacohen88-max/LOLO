import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import {
  anonCatalogIsClosed,
  GUEST_EVENT_FIELDS,
  mapGuestEvent,
} from "../lib/events/guest-shape";

const sql = fs.readFileSync(new URL("../supabase/events-anon-read.sql", import.meta.url), "utf8");

describe("event and gift privacy", () => {
  it("returns only the fields the guest page renders", () => {
    const event = mapGuestEvent(
      {
        id: "event-1",
        slug: "lolo-demo",
        title: "יום הולדת",
        host_name: "מארח לדוגמה",
        event_date: "2026-10-20",
        venue_name: "הבית",
        address: "רחוב לדוגמה",
        message: "בואו",
        money_amounts: [150],
        created_at: "2026-10-01T00:00:00.000Z",
      },
      [
        {
          id: "gift-1",
          event_id: "event-1",
          title: "ספר",
          description: "ספר חדש",
          target_amount: 120,
          icon: "📚",
          priority: 1,
          active: true,
          store_name: "חנות",
        },
      ],
    );

    assert.deepEqual(Object.keys(event), [...GUEST_EVENT_FIELDS]);
    assert.equal(event.slug, "lolo-demo");
    assert.equal(event.gifts[0]?.title, "ספר");
    assert.equal(event.gifts[0]?.storeId, null);
    assert.equal("service_role" in event, false);
  });

  it("treats a denied or empty anonymous catalog as closed", () => {
    assert.equal(anonCatalogIsClosed(401, 1), true);
    assert.equal(anonCatalogIsClosed(403, 1), true);
    assert.equal(anonCatalogIsClosed(200, 0), true);
    assert.equal(anonCatalogIsClosed(200, 2), false);
  });

  it("prepares sql that removes anonymous reads without deleting data", () => {
    assert.match(sql, /drop policy if exists "Public can read events" on public\.events/i);
    assert.match(sql, /drop policy if exists "Public can read event gifts" on public\.event_gifts/i);
    assert.match(sql, /revoke select on table public\.events from anon, authenticated, public/i);
    assert.match(sql, /revoke select on table public\.event_gifts from anon, authenticated, public/i);
    assert.match(sql, /grant all on table public\.events to service_role/i);
    assert.doesNotMatch(sql, /\b(delete\s+from|drop\s+table|truncate|update\s+public\.)/i);
  });

  it("keeps browser event loading off the public supabase key", () => {
    const repository = fs.readFileSync(
      new URL("../lib/events/repository.ts", import.meta.url),
      "utf8",
    );
    const route = fs.readFileSync(
      new URL("../app/api/events/[slug]/route.ts", import.meta.url),
      "utf8",
    );
    const hostPage = fs.readFileSync(
      new URL("../app/host/events/[eventId]/page.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(repository.includes("getSupabaseBrowserClient"), false);
    assert.equal(repository.includes('.from("events")'), false);
    assert.equal(repository.includes('.from("event_gifts")'), false);
    assert.match(repository, /\/api\/events\//);
    assert.equal(route.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
    assert.match(hostPage, /session\.eventId !== eventId/);
  });

  it("checks the live anonymous catalog after the sql is applied", {
    skip: process.env.LOLO_VERIFY_ANON_LOCK === "1" ? false : "run after applying events-anon-read.sql",
  }, async () => {
    const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const value = (name: string) =>
      env
        .split(/\r?\n/)
        .find((line) => line.startsWith(`${name}=`))
        ?.slice(name.length + 1)
        ?.trim() ?? "";
    const url = value("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
    const anon = value("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    assert.ok(url && anon);

    for (const table of ["events", "event_gifts"]) {
      const response = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
        },
      });
      const body: unknown = await response.json();
      const rowCount = Array.isArray(body) ? body.length : 0;
      assert.equal(
        anonCatalogIsClosed(response.status, rowCount),
        true,
        `${table} status ${response.status} rows ${rowCount}`,
      );
    }
  });
});
