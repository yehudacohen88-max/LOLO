import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isGuestDirectAccess } from "../lib/beta/guest-access";
import {
  PILOT_FEEDBACK_CLOSED,
  PILOT_FEEDBACK_INVALID,
  parsePilotFeedback,
} from "../lib/pilot/feedback";
import {
  SETTLEMENTS_PILOT_MESSAGE,
  SettlementPilotDisabledError,
  settlementsEnabled,
} from "../lib/settlements/availability";
import {
  cancelSettlement,
  createStoreSettlement,
  getSettlement,
  listSettlements,
  listStoreBalances,
  listStoreSettlementDetails,
  markSettlementPaid,
} from "../lib/settlements/repository";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function firstGateBefore(source: string, marker: string) {
  const gate = source.indexOf("if (!settlementsEnabled())");
  const hidden = source.indexOf("notFound()");
  const use = source.indexOf(marker);
  assert.ok(gate >= 0, "missing settlementsEnabled gate");
  assert.ok(hidden > gate, "notFound() is not after the gate");
  assert.ok(use > hidden, `${marker} runs before the page is hidden`);
}

describe("settlement pilot flag", () => {
  it("stays off unless the value is an explicit on switch", () => {
    assert.equal(settlementsEnabled(undefined), false);
    assert.equal(settlementsEnabled(""), false);
    assert.equal(settlementsEnabled("false"), false);
    assert.equal(settlementsEnabled("0"), false);
    assert.equal(settlementsEnabled("off"), false);
    assert.equal(settlementsEnabled(" TRUE "), true);
    assert.equal(settlementsEnabled("1"), true);
    assert.equal(settlementsEnabled("yes"), true);
    assert.equal(settlementsEnabled("on"), true);
  });
});

describe("settlement pages and links stay hidden", () => {
  it("hides the admin and store settlement pages before any settlement read", () => {
    firstGateBefore(read("../app/admin/settlements/page.tsx"), "listSettlements(");
    firstGateBefore(read("../app/admin/settlements/page.tsx"), "listStoreBalances(");
    firstGateBefore(
      read("../app/admin/settlements/[settlementId]/page.tsx"),
      "getSettlement(",
    );
    firstGateBefore(
      read("../app/store/settlements/page.tsx"),
      "listStoreSettlementDetails(",
    );
  });

  it("drops settlement links from the admin nav, dashboard, redemptions, and store redeem page", () => {
    const nav = read("../app/admin/admin-nav.tsx");
    const layout = read("../app/admin/layout.tsx");
    const home = read("../app/admin/page.tsx");
    const redemptions = read("../app/admin/redemptions/page.tsx");
    const redeem = read("../app/store/redeem/page.tsx");

    assert.match(nav, /showSettlements = false/);
    assert.match(nav, /link\.href !== "\/admin\/settlements"/);
    assert.match(layout, /showSettlements=\{settlementsEnabled\(\)\}/);
    assert.ok(home.indexOf("settlementsEnabled()") < home.indexOf('href="/admin/settlements"'));
    assert.match(home, /settlementsEnabled\(\) && snapshot\?\.settlementsReady/);
    assert.match(redemptions, /settlementsEnabled\(\) \?/);
    assert.match(redeem, /settlementsEnabled\(\) \?/);
    assert.ok(redeem.indexOf("settlementsEnabled()") < redeem.indexOf('href="/store/settlements"'));

    const proxy = read("../proxy.ts");
    assert.ok(proxy.indexOf("closedSettlementPage(pathname)") < proxy.indexOf("betaGateModeFromEnv()"));
    assert.match(proxy, /\/admin\/settlements/);
    assert.match(proxy, /\/store\/settlements/);
  });
});

describe("settlement APIs stay closed", () => {
  const routes = [
    ["../app/api/admin/settlements/route.ts", "createStoreSettlement("],
    ["../app/api/admin/settlements/[settlementId]/cancel/route.ts", "cancelSettlement("],
    ["../app/api/admin/settlements/[settlementId]/pay/route.ts", "markSettlementPaid("],
  ] as const;

  for (const [path, call] of routes) {
    it(`returns 501 before ${call} can reach the database`, async () => {
      const source = read(path);
      assert.ok(source.indexOf("settlementPilotUnavailable()") < source.indexOf(call));
      const previous = process.env.SETTLEMENTS_ENABLED;
      delete process.env.SETTLEMENTS_ENABLED;
      const calls: string[] = [];
      const original = globalThis.fetch;
      globalThis.fetch = async (input) => {
        calls.push(String(input));
        throw new Error("settlement pilot called the network");
      };
      try {
        const { POST } = await import(path.replace(/\.ts$/, ""));
        const response = await POST(
          new Request("http://local.test/api/admin/settlements", {
            method: "POST",
            body: "{}",
          }),
          { params: Promise.resolve({ settlementId: "00000000-0000-4000-8000-000000000001" }) },
        );
        assert.equal(response.status, 501);
        const body = (await response.json()) as { error?: string };
        assert.equal(body.error, SETTLEMENTS_PILOT_MESSAGE);
        assert.equal(calls.length, 0);
      } finally {
        globalThis.fetch = original;
        if (previous === undefined) {
          delete process.env.SETTLEMENTS_ENABLED;
        } else {
          process.env.SETTLEMENTS_ENABLED = previous;
        }
      }
    });
  }

  it("refuses settlement repository calls before a client is used", async () => {
    const previous = process.env.SETTLEMENTS_ENABLED;
    delete process.env.SETTLEMENTS_ENABLED;
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      throw new Error("settlement pilot called the network");
    };
    try {
      const blocked = [
        () => listSettlements({}),
        () => getSettlement("00000000-0000-4000-8000-000000000001"),
        () => listStoreBalances(),
        () => listStoreSettlementDetails("00000000-0000-4000-8000-000000000001"),
        () => createStoreSettlement("00000000-0000-4000-8000-000000000001", "key"),
        () => markSettlementPaid("00000000-0000-4000-8000-000000000001", null, null),
        () => cancelSettlement("00000000-0000-4000-8000-000000000001"),
      ];
      for (const attempt of blocked) {
        await assert.rejects(async () => {
          await attempt();
        }, (error: unknown) => {
          assert.ok(error instanceof SettlementPilotDisabledError);
          assert.equal(error.status, 501);
          assert.equal(error.message, SETTLEMENTS_PILOT_MESSAGE);
          return true;
        });
      }
      assert.equal(calls.length, 0);
    } finally {
      globalThis.fetch = original;
      if (previous === undefined) {
        delete process.env.SETTLEMENTS_ENABLED;
      } else {
        process.env.SETTLEMENTS_ENABLED = previous;
      }
    }
  });
});

describe("pilot feedback", () => {
  const valid = {
    role: "guest",
    device: "phone",
    completed: "yes",
    clarity: 4,
    demoPaymentClear: true,
    wouldUse: "maybe",
    notes: "  היה ברור  ",
  };

  it("accepts the seven answers and trims the note", () => {
    const parsed = parsePilotFeedback(valid);
    assert.equal(parsed.notes, "היה ברור");
    assert.equal(parsed.demoPaymentClear, true);
    assert.equal(parsePilotFeedback({ ...valid, demoPaymentClear: false }).demoPaymentClear, false);
  });

  it("rejects a missing answer, a score outside 1 to 5, and a long note", () => {
    assert.throws(() => parsePilotFeedback({ ...valid, role: "admin" }), /מארח/);
    assert.throws(() => parsePilotFeedback({ ...valid, clarity: 0 }), /1 עד 5/);
    assert.throws(() => parsePilotFeedback({ ...valid, clarity: 6 }), /1 עד 5/);
    assert.throws(() => parsePilotFeedback({ ...valid, demoPaymentClear: "yes" }), /לא נגבה כסף/);
    assert.throws(() => parsePilotFeedback({ ...valid, notes: "א".repeat(1001) }), /ארוכה/);
    assert.throws(() => parsePilotFeedback(null), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, PILOT_FEEDBACK_INVALID);
      return true;
    });
  });

  it("keeps /feedback behind the beta gate and closed until the table exists", async () => {
    assert.equal(isGuestDirectAccess("/feedback", "GET"), false);
    assert.equal(isGuestDirectAccess("/api/feedback", "POST"), false);

    const page = read("../app/feedback/page.tsx");
    assert.match(page, /pilotFeedbackTableReady/);
    assert.match(page, /ready \? <FeedbackForm \/> :/);
    assert.match(page, /PILOT_FEEDBACK_CLOSED/);

    const route = read("../app/api/feedback/route.ts");
    assert.ok(route.indexOf("pilotFeedbackTableReady()") < route.indexOf("insertPilotFeedback("));

    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
    const { POST } = await import("../app/api/feedback/route");
    const response = await POST(
      new Request("http://local.test/api/feedback", {
        method: "POST",
        body: JSON.stringify(valid),
      }),
    );
    assert.equal(response.status, 503);
    const body = (await response.json()) as { error?: string };
    assert.equal(body.error, PILOT_FEEDBACK_CLOSED);
    } finally {
      if (savedUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
      }
      if (savedKey === undefined) {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      } else {
        process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
      }
    }
  });
});

describe("pilot sql files", () => {
  function executableSql(source: string) {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
  }

  it("keeps the inventory and the isolation file from writing when executed as-is", () => {
    const inventory = executableSql(read("../supabase/readonly/test-data-inventory.sql"));
    const isolation = executableSql(read("../supabase/pilot-isolate-test-data.sql"));
    const writes = /\b(insert|update|delete|alter|drop|truncate|grant|revoke)\b/i;
    assert.doesNotMatch(inventory, writes);
    assert.doesNotMatch(isolation, writes);
    assert.match(inventory, /\bselect\b/i);
    assert.match(read("../supabase/pilot-isolate-test-data.sql"), /REQUIRES APPROVAL/);
    assert.match(read("../supabase/pilot-isolate-test-data.sql"), /rollback/i);
    assert.match(read("../supabase/pilot-feedback.sql"), /REQUIRES APPROVAL/);
    assert.match(read("../supabase/pilot-feedback.sql"), /pilot_feedback/);
  });
});
