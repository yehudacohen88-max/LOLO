import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "../lib/admin/session";
import type { Db, DbError, DbResult } from "../lib/desk/db";
import {
  EVENT_DETAIL_COLUMNS,
  EVENT_LIST_COLUMNS,
  GUEST_COLUMNS,
  ORDER_DETAIL_COLUMNS,
  ORDER_LIST_COLUMNS,
  columnsArePublic,
  orderDemoFlag,
} from "../lib/desk/directory";
import { STORE_LOCKED_FIELDS } from "../lib/desk/messages";
import { storeTransactionsCsv } from "../lib/desk/transactions-csv";
import { DEMO_REDEMPTION_LABEL } from "../lib/settlements/labels";
import { STORE_SESSION_COOKIE, createStoreSessionToken } from "../lib/store/session";
import { handleAdminAudit } from "../app/api/admin/audit/route";
import { handleAdminEvents } from "../app/api/admin/events/route";
import { handleAdminGuests } from "../app/api/admin/guests/route";
import { handleAdminNote } from "../app/api/admin/notes/route";
import { handleAdminOrders } from "../app/api/admin/orders/route";
import { handleAdminPayments } from "../app/api/admin/payments/route";
import { handleAdminRefunds } from "../app/api/admin/refunds/route";
import { handleStoreBusinessPatch } from "../app/api/store/business/route";
import { handleStoreTransactionsExport } from "../app/api/store/transactions/export/route";
import { handleStoreTransactions } from "../app/api/store/transactions/route";
import { __clearTestCookies, __setTestCookies } from "./next-headers-stub.mjs";

const STORE_A = "11111111-1111-4111-8111-111111111111";
const STORE_B = "22222222-2222-4222-8222-222222222222";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const EVENT_ID = "44444444-4444-4444-8444-444444444444";

type Row = Record<string, unknown>;
type Call = {
  table: string;
  action: "select" | "insert" | "update";
  columns: string;
  patch: Record<string, unknown> | null;
  insert: Record<string, unknown> | null;
  filters: Array<{ op: string; column: string; value: unknown }>;
};

function memoryDb(state: {
  tables: Record<string, Row[]>;
  missingDemo?: boolean;
  auditAvailable?: boolean;
  notesAvailable?: boolean;
}) {
  const calls: Call[] = [];
  const db = {
    calls,
    tables: state.tables,
    from(table: string) {
      const op: Call = {
        table,
        action: "select",
        columns: "",
        patch: null,
        insert: null,
        filters: [],
      };
      const query = {
        select(columns: string) {
          op.columns = columns;
          return query;
        },
        insert(row: Record<string, unknown>) {
          op.action = "insert";
          op.insert = row;
          return query;
        },
        update(row: Record<string, unknown>) {
          op.action = "update";
          op.patch = row;
          return query;
        },
        eq(column: string, value: unknown) {
          op.filters.push({ op: "eq", column, value });
          return query;
        },
        gte(column: string, value: unknown) {
          op.filters.push({ op: "gte", column, value });
          return query;
        },
        lt(column: string, value: unknown) {
          op.filters.push({ op: "lt", column, value });
          return query;
        },
        in() {
          return query;
        },
        or() {
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle() {
          return finish(true);
        },
        then(resolve: (value: DbResult) => unknown, reject?: (reason: unknown) => unknown) {
          return finish(false).then(resolve, reject);
        },
      };
      function finish(single: boolean) {
        calls.push({
          ...op,
          filters: op.filters.map((filter) => ({ ...filter })),
          patch: op.patch ? { ...op.patch } : null,
          insert: op.insert ? { ...op.insert } : null,
        });
        return Promise.resolve(execute(state, calls[calls.length - 1], single));
      }
      return query;
    },
  };
  return db;
}

function matches(row: Row, call: Call) {
  return call.filters.every((filter) => {
    const value = row[filter.column];
    if (filter.op === "eq") {
      return value === filter.value;
    }
    if (filter.op === "gte") {
      return String(value) >= String(filter.value);
    }
    if (filter.op === "lt") {
      return String(value) < String(filter.value);
    }
    return true;
  });
}

function execute(
  state: { tables: Record<string, Row[]>; missingDemo?: boolean; auditAvailable?: boolean; notesAvailable?: boolean },
  call: Call,
  single: boolean,
): DbResult {
  if (call.table === "redemptions" && state.missingDemo && call.columns.includes("demo_only")) {
    const error: DbError = { code: "PGRST204", message: "column demo_only does not exist" };
    return { data: null, error };
  }
  if (call.table === "audit_events" && state.auditAvailable === false) {
    return { data: null, error: { code: "42P01", message: "relation audit_events does not exist" } };
  }
  if (call.table === "support_notes" && state.notesAvailable === false) {
    return { data: null, error: { code: "42P01", message: "relation support_notes does not exist" } };
  }
  const table = state.tables[call.table] ?? [];
  if (call.action === "insert" && call.insert) {
    const row = { id: `${call.table}-1`, ...call.insert };
    table.push(row);
    state.tables[call.table] = table;
    return { data: single ? { id: row.id } : [row], error: null };
  }
  if (call.action === "update") {
    const row = table.find((item) => matches(item, call));
    if (row && call.patch) {
      Object.assign(row, call.patch);
    }
    return { data: single ? (row ? { id: row.id } : null) : row ? [row] : [], error: null };
  }
  const rows = table.filter((row) => matches(row, call));
  return { data: single ? (rows[0] ?? null) : rows, error: null };
}

function asDb(db: ReturnType<typeof memoryDb>) {
  return db as unknown as Db;
}

function redemption(id: string, storeId: string, amount: number, demoOnly: boolean): Row {
  return {
    id,
    store_id: storeId,
    amount,
    redeemed_at: "2026-03-02T12:00:00.000Z",
    channel: "store",
    reference: "",
    settlement_status: "UNSETTLED",
    voucher_id: `voucher-${id}`,
    vouchers: {
      code: `CODE-${id}`,
      gift_title: "מתנה",
      event_title: "אירוע",
      demo_only: demoOnly,
    },
  };
}

function storeCookie(storeId: string) {
  __setTestCookies({ [STORE_SESSION_COOKIE]: createStoreSessionToken(storeId) });
}

function adminCookie() {
  __setTestCookies({ [ADMIN_SESSION_COOKIE]: createAdminSessionToken() });
}

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "permissions-admin-secret";
  process.env.STORE_SESSION_SECRET = "permissions-store-secret";
  __setTestCookies({});
});

afterEach(() => {
  __clearTestCookies();
});

describe("listed columns stay free of secrets", () => {
  it("does not select access tokens, invite tokens, or code hashes", () => {
    for (const columns of [
      EVENT_LIST_COLUMNS,
      EVENT_DETAIL_COLUMNS,
      ORDER_LIST_COLUMNS,
      ORDER_DETAIL_COLUMNS,
      GUEST_COLUMNS,
    ]) {
      assert.equal(columnsArePublic(columns), true);
    }
  });
});

describe("demo payment flag", () => {
  it("labels demo references and refuses to guess when the columns are missing", () => {
    assert.equal(
      orderDemoFlag({ paymentColumns: false, paymentProvider: "demo", paymentReference: "demo-1" }),
      "unknown",
    );
    assert.equal(
      orderDemoFlag({ paymentColumns: true, paymentProvider: "demo", paymentReference: "demo-abc" }),
      "demo",
    );
    assert.equal(
      orderDemoFlag({ paymentColumns: true, paymentProvider: "", paymentReference: "" }),
      "demo",
    );
    assert.equal(
      orderDemoFlag({ paymentColumns: true, paymentProvider: "other", paymentReference: "pay-1" }),
      "unmarked",
    );
  });
});

describe("a store cannot see another store", () => {
  it("scopes redemption history to the signed-in store and leaves demo out of the non-demo total", async () => {
    const db = memoryDb({
      tables: {
        redemptions: [
          redemption("a", STORE_A, 40, false),
          redemption("demo", STORE_A, 15, true),
          redemption("b", STORE_B, 90, false),
        ],
      },
    });
    storeCookie(STORE_A);
    const response = await handleStoreTransactions(
      new Request(`http://local.test/api/store/transactions?store=${STORE_B}`),
      asDb(db),
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      rows: Array<{ id: string; storeId: string; label: string }>;
      standardGross: number;
      demoGross: number;
    };
    assert.deepEqual(
      body.rows.map((row) => row.id).sort(),
      ["a", "demo"],
    );
    assert.equal(body.rows.every((row) => row.storeId === STORE_A), true);
    assert.equal(body.standardGross, 40);
    assert.equal(body.demoGross, 15);
    assert.equal(body.rows.find((row) => row.id === "demo")?.label, DEMO_REDEMPTION_LABEL);
    assert.equal(
      db.calls.some((call) => call.filters.some((filter) => filter.value === STORE_B)),
      false,
    );
    assert.equal(
      db.calls.every((call) => call.filters.some((filter) => filter.column === "store_id" && filter.value === STORE_A)),
      true,
    );
  });

  it("keeps the same scope and the same exclusion in the CSV", async () => {
    const db = memoryDb({
      tables: {
        redemptions: [
          redemption("a", STORE_A, 40, false),
          redemption("demo", STORE_A, 15, true),
          redemption("b", STORE_B, 90, false),
        ],
      },
    });
    storeCookie(STORE_A);
    const response = await handleStoreTransactionsExport(
      new Request("http://local.test/api/store/transactions/export?store=ignored"),
      asDb(db),
    );
    assert.equal(response.status, 200);
    const csv = await response.text();
    assert.equal(csv.includes("CODE-b"), false);
    assert.equal(csv.includes(DEMO_REDEMPTION_LABEL), true);
    const summary = csv.split("\r\n").find((line) => line.startsWith("סכום מימושים שאינם הדגמה"));
    assert.ok(summary);
    assert.equal(summary?.includes(",40,"), true);
    assert.equal(summary?.includes(",90,") || summary?.includes(",105,"), false);
    const page = storeTransactionsCsv({
      available: true,
      classificationAvailable: true,
      message: "",
      rows: [],
      standardGross: 40,
      demoGross: 15,
    });
    assert.equal(page.includes(DEMO_REDEMPTION_LABEL), true);
  });

  it("does not publish a non-demo total when demo classification is missing", async () => {
    const db = memoryDb({
      tables: {
        redemptions: [redemption("a", STORE_A, 40, false), redemption("b", STORE_B, 90, false)],
      },
      missingDemo: true,
    });
    storeCookie(STORE_A);
    const response = await handleStoreTransactions(
      new Request("http://local.test/api/store/transactions?kind=standard"),
      asDb(db),
    );
    const body = (await response.json()) as { rows: unknown[]; standardGross: number | null; message: string };
    assert.equal(body.rows.length, 0);
    assert.equal(body.standardGross, null);
    assert.match(body.message, /סיווג ההדגמה/);
    assert.equal(
      db.calls.every((call) => call.filters.some((filter) => filter.value === STORE_A)),
      true,
    );
  });

  it("rejects commission fields and updates only the signed-in store", async () => {
    const blocked = memoryDb({ tables: { stores: [{ id: STORE_A, name: "Old" }] } });
    storeCookie(STORE_A);
    const rejected = await handleStoreBusinessPatch(
      new Request("http://local.test/api/store/business", {
        method: "PATCH",
        body: JSON.stringify({
          name: "New",
          commissionPercent: 12,
          websiteUrl: "",
          contactName: "",
          contactPhone: "",
          contactEmail: "",
        }),
      }),
      asDb(blocked),
    );
    assert.equal(rejected.status, 400);
    const rejectedBody = (await rejected.json()) as { error: string };
    assert.equal(rejectedBody.error, STORE_LOCKED_FIELDS);
    assert.equal(blocked.calls.length, 0);

    const db = memoryDb({ tables: { stores: [{ id: STORE_A, name: "Old" }, { id: STORE_B, name: "Other" }] } });
    const saved = await handleStoreBusinessPatch(
      new Request("http://local.test/api/store/business", {
        method: "PATCH",
        body: JSON.stringify({
          name: "New name",
          websiteUrl: "",
          contactName: "Ada",
          contactPhone: "",
          contactEmail: "",
          id: STORE_B,
        }),
      }),
      asDb(db),
    );
    assert.equal(saved.status, 200);
    const update = db.calls.find((call) => call.action === "update");
    assert.ok(update);
    assert.equal(update?.filters.some((filter) => filter.column === "id" && filter.value === STORE_A), true);
    assert.equal(update?.patch?.commission_percent, undefined);
    assert.equal(update?.patch?.name, "New name");
    assert.equal(update?.patch?.contact_name, "Ada");
    const stores = db.tables.stores ?? [];
    assert.equal(stores.find((row) => row.id === STORE_B)?.name, "Other");
    assert.equal(stores.find((row) => row.id === STORE_A)?.name, "New name");
  });
});

describe("non-admin cannot reach admin routes", () => {
  const routes: Array<(request: Request) => Promise<Response>> = [
    () => handleAdminAudit(),
    (request) => handleAdminEvents(request),
    (request) => handleAdminGuests(request),
    (request) => handleAdminOrders(request),
    () => handleAdminPayments(),
    () => handleAdminRefunds(),
    (request) => handleAdminNote(request),
  ];

  for (const [name, cookie] of [
    ["anonymous", () => __setTestCookies({})],
    ["store", () => storeCookie(STORE_A)],
  ] as const) {
    it(`returns 401 for a ${name} caller`, async () => {
      cookie();
      const request = new Request("http://local.test/api/admin/desk", {
        method: "POST",
        body: JSON.stringify({ subjectKind: "order", subjectId: ORDER_ID, body: "הערה" }),
      });
      for (const route of routes) {
        const response = await route(request);
        assert.equal(response.status, 401);
      }
    });
  }

  it("does not let an admin cookie read a store history", async () => {
    adminCookie();
    const response = await handleStoreTransactions(new Request("http://local.test/api/store/transactions"));
    assert.equal(response.status, 401);
  });
});

describe("admin notes fail closed without an audit log", () => {
  it("does not insert a note when audit_events is missing", async () => {
    const db = memoryDb({
      tables: {
        orders: [{ id: ORDER_ID }],
        events: [{ id: EVENT_ID }],
        support_notes: [],
        audit_events: [],
      },
      auditAvailable: false,
      notesAvailable: true,
    });
    adminCookie();
    const response = await handleAdminNote(
      new Request("http://local.test/api/admin/notes", {
        method: "POST",
        body: JSON.stringify({ subjectKind: "order", subjectId: ORDER_ID, body: "התקשרו אלינו" }),
      }),
      asDb(db),
    );
    assert.equal(response.status, 503);
    assert.equal(db.calls.some((call) => call.table === "support_notes" && call.action === "insert"), false);
  });

  it("writes the note only after an audit row", async () => {
    const db = memoryDb({
      tables: {
        orders: [{ id: ORDER_ID }],
        support_notes: [],
        audit_events: [],
      },
      auditAvailable: true,
      notesAvailable: true,
    });
    adminCookie();
    const response = await handleAdminNote(
      new Request("http://local.test/api/admin/notes", {
        method: "POST",
        body: JSON.stringify({ subjectKind: "order", subjectId: ORDER_ID, body: "נבדק" }),
      }),
      asDb(db),
    );
    assert.equal(response.status, 200);
    const audit = db.calls.find((call) => call.table === "audit_events" && call.action === "insert");
    const note = db.calls.find((call) => call.table === "support_notes" && call.action === "insert");
    assert.ok(audit);
    assert.ok(note);
    assert.ok(db.calls.indexOf(audit) < db.calls.indexOf(note));
    assert.equal(audit?.insert?.action, "support_note.create");
    assert.equal(note?.insert?.subject_id, ORDER_ID);
  });
});
