import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isDemoMoney } from "../lib/invoices/demo-order";
import { MemoryDocumentStore } from "../lib/invoices/memory-store";
import {
  RefusedDocumentProvider,
  SimulatedDocumentProvider,
  createDocumentProvider,
} from "../lib/invoices/providers";
import { TEST_DOCUMENT_WATERMARK } from "../lib/invoices/render";
import { DocumentConfigError } from "../lib/invoices/settings";
import { creditDocument, issueOrderDocument } from "../lib/invoices/service";
import type { DocumentOrder, DocumentProvider, DocumentSettings } from "../lib/invoices/types";
import {
  notifyPurchaseConfirmed,
  notifyRefund,
  type NotificationDeps,
} from "../lib/notifications/hooks";
import { MemoryNotificationStore } from "../lib/notifications/memory-store";
import {
  RefusedChannelProvider,
  SimulatedChannelProvider,
  createNotificationProvider,
  createSimulatedProviders,
} from "../lib/notifications/providers";
import {
  isMissingNotificationSchema,
  rethrowIfNotificationSchema,
  NotificationSchemaMissingError,
} from "../lib/notifications/schema-error";
import { renderCopy, builtinTemplate } from "../lib/notifications/templates";
import type { PurchaseNotice } from "../lib/notifications/types";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function purchase(overrides: Partial<PurchaseNotice> = {}): PurchaseNotice {
  return {
    orderId: ORDER_ID,
    wantsConfirmation: true,
    guestName: "דנה",
    guestEmail: "Dana@Example.com",
    guestPhone: "050-123-4567",
    hostName: "יוסי",
    eventTitle: "יום הולדת",
    contributionAmount: 100,
    chargedAmount: 118,
    currency: "ILS",
    paymentProvider: "demo",
    paymentReference: "demo-abc",
    paymentStatus: "paid",
    ...overrides,
  };
}

function deps(
  store: MemoryNotificationStore,
  providers: { email: SimulatedChannelProvider },
  notice: PurchaseNotice,
): NotificationDeps {
  return {
    store,
    channels: ["email"],
    providers,
    loadPurchase: async () => notice,
  };
}

function demoOrder(overrides: Partial<DocumentOrder> = {}): DocumentOrder {
  return {
    id: ORDER_ID,
    eventTitle: "יום הולדת",
    guestName: "דנה",
    contributionAmount: 100,
    feeAmount: 0,
    chargedAmount: 118,
    paymentProvider: "demo",
    paymentReference: "demo-abc",
    paymentStatus: "paid",
    ...overrides,
  };
}

function readySettings(overrides: Partial<DocumentSettings> = {}): DocumentSettings {
  return {
    vatRatePercent: 18,
    vatIncluded: true,
    documentKind: "receipt",
    currency: "ILS",
    ...overrides,
  };
}

async function withFetchGuard<T>(run: () => Promise<T>) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error("network");
  }) as typeof fetch;
  try {
    const result = await run();
    assert.equal(calls, 0);
    return result;
  } finally {
    globalThis.fetch = original;
  }
}

describe("simulated notifications", () => {
  it("writes a queued row and then sent_simulated, without calling the network", async () => {
    await withFetchGuard(async () => {
      const store = new MemoryNotificationStore();
      const providers = createSimulatedProviders();
      const result = await notifyPurchaseConfirmed(
        ORDER_ID,
        deps(store, providers, purchase()),
      );

      assert.equal(result.skipped, false);
      assert.equal(result.messages.length, 1);
      assert.equal(result.messages[0]?.idempotent, false);
      assert.equal(result.messages[0]?.message.status, "sent_simulated");
      assert.equal(result.messages[0]?.message.simulated, true);
      assert.equal(result.messages[0]?.message.recipient, "dana@example.com");
      assert.equal(result.messages[0]?.message.providerResponse, "simulated; no network");
      assert.equal(store.rows.size, 1);
      assert.equal(store.versions[0]?.status, "queued");
      assert.equal(store.versions.at(-1)?.status, "sent_simulated");
      assert.equal(providers.email.sendCalls, 1);
      assert.match(providers.email.recorded[0]?.body ?? "", /דנה/);
      assert.match(providers.email.recorded[0]?.body ?? "", /תשלום הדגמה/);
    });
  });

  it("records failed when the simulated provider throws, and keeps the would-be message", async () => {
    await withFetchGuard(async () => {
      const store = new MemoryNotificationStore();
      const providers = createSimulatedProviders();
      providers.email.failure = new Error("ספק ההדגמה נכשל בכוונה");
      const result = await notifyPurchaseConfirmed(
        ORDER_ID,
        deps(store, providers, purchase()),
      );

      assert.equal(result.messages[0]?.message.status, "failed");
      assert.match(result.messages[0]?.message.error ?? "", /נכשל בכוונה/);
      assert.match(result.messages[0]?.message.body ?? "", /דנה/);
      assert.equal(store.versions[0]?.status, "queued");
      assert.equal(providers.email.recorded.length, 1);
      assert.equal(store.rows.size, 1);
    });
  });

  it("does not send again for the same event, entity, recipient, and channel", async () => {
    const store = new MemoryNotificationStore();
    const providers = createSimulatedProviders();
    const notice = purchase();
    const first = await notifyPurchaseConfirmed(ORDER_ID, deps(store, providers, notice));
    const second = await notifyPurchaseConfirmed(ORDER_ID, deps(store, providers, notice));

    assert.equal(first.messages[0]?.idempotent, false);
    assert.equal(second.messages[0]?.idempotent, true);
    assert.equal(second.messages[0]?.message.id, first.messages[0]?.message.id);
    assert.equal(providers.email.sendCalls, 1);
    assert.equal(store.rows.size, 1);
  });

  it("skips the guest confirmation when wants_confirmation is false", async () => {
    const store = new MemoryNotificationStore();
    const providers = createSimulatedProviders();
    const result = await notifyPurchaseConfirmed(
      ORDER_ID,
      deps(store, providers, purchase({ wantsConfirmation: false })),
    );

    assert.equal(result.skipped, true);
    assert.equal(result.reason, "wants_confirmation");
    assert.equal(result.messages.length, 0);
    assert.equal(store.rows.size, 0);
    assert.equal(providers.email.sendCalls, 0);
  });

  it("skips a refund the guest did not ask to hear about", async () => {
    const store = new MemoryNotificationStore();
    const providers = createSimulatedProviders();
    const result = await notifyRefund(
      ORDER_ID,
      deps(store, providers, purchase({ wantsConfirmation: false })),
    );
    assert.equal(result.reason, "wants_confirmation");
    assert.equal(store.rows.size, 0);
  });

  it("escapes email values once and does not render braces injected by the guest", () => {
    const copy = builtinTemplate("purchase_confirmed", "email");
    const rendered = renderCopy(
      copy,
      {
        guestName: '<script>דנה</script> {{chargedAmount}}',
        eventTitle: "יום הולדת",
        chargedAmount: "118.00",
        currencySuffix: " ILS",
        orderId: ORDER_ID,
        paymentNote: "",
      },
      "email",
    );

    assert.match(rendered.body, /&lt;script&gt;דנה&lt;\/script&gt;/);
    assert.equal(rendered.body.includes("<script>"), false);
    assert.equal(rendered.body.split("118.00").length - 1, 1);
    assert.match(rendered.body, /\{\{chargedAmount\}\}/);
  });

  it("fails closed for a real provider name and does not call send", async () => {
    await withFetchGuard(async () => {
      const provider = createNotificationProvider("email", {
        NOTIFICATION_EMAIL_PROVIDER: "sendgrid",
      });
      assert.equal(provider.isSimulated, false);
      assert.equal(provider.name, "sendgrid");
      assert.ok(provider instanceof RefusedChannelProvider);

      const store = new MemoryNotificationStore();
      const result = await notifyPurchaseConfirmed(ORDER_ID, {
        store,
        channels: ["email"],
        providers: { email: provider },
        loadPurchase: async () => purchase(),
      });

      assert.equal(result.messages[0]?.message.status, "failed");
      assert.match(result.messages[0]?.message.error ?? "", /אינו מחובר/);
      assert.equal((provider as RefusedChannelProvider).sendCalls, 0);
      assert.equal(provider.isSimulated, false);
    });
  });

  it("treats a missing notification table as unavailable", () => {
    assert.equal(
      isMissingNotificationSchema({
        code: "42P01",
        message: 'relation "public.notification_messages" does not exist',
      }),
      true,
    );
    assert.equal(
      isMissingNotificationSchema({
        code: "42703",
        message: "column vat_rate_percent of relation platform_settings does not exist",
      }),
      true,
    );
    assert.equal(
      isMissingNotificationSchema({
        code: "42P01",
        message: 'relation "public.events" does not exist',
      }),
      false,
    );
    assert.throws(
      () =>
        rethrowIfNotificationSchema({
          code: "PGRST205",
          message: "Could not find the table 'public.documents' in the schema cache",
        }),
      NotificationSchemaMissingError,
    );
  });
});

describe("simulated documents", () => {
  it("stores a demo order document with simulated true and the test watermark", async () => {
    await withFetchGuard(async () => {
      const store = new MemoryDocumentStore();
      const provider = new SimulatedDocumentProvider();
      const document = await issueOrderDocument(demoOrder(), readySettings(), { store, provider });

      assert.equal(document.simulated, true);
      assert.equal(document.demoOrder, true);
      assert.equal(document.kind, "receipt");
      assert.equal(document.watermark, TEST_DOCUMENT_WATERMARK);
      assert.equal(document.paymentReference, "demo-abc");
      assert.match(document.body, /מסמך בדיקה – אינו מסמך חשבונאי/);
      assert.match(document.body, /שיעור מע״מ: 18%/);
      assert.equal(document.body.includes("17%"), false);
      assert.match(document.body, /simulated: true/);
      assert.equal(store.rows.length, 1);
      assert.equal(provider.sendCalls, 1);
    });
  });

  it("keeps simulated true even if the provider tries to clear the flag", async () => {
    const store = new MemoryDocumentStore();
    const provider: DocumentProvider = {
      name: "simulated",
      isSimulated: true,
      async issue() {
        return {
          externalId: "sim-evil",
          body: "ללא חותמת",
          watermark: "",
          simulated: false,
        };
      },
      async cancel() {
        throw new Error("unused");
      },
    };

    const document = await issueOrderDocument(demoOrder(), readySettings(), { store, provider });
    assert.equal(document.simulated, true);
    assert.equal(document.watermark, TEST_DOCUMENT_WATERMARK);
    assert.match(document.body, /מסמך בדיקה – אינו מסמך חשבונאי/);
  });

  it("returns the same document when the order is issued again", async () => {
    const store = new MemoryDocumentStore();
    const provider = new SimulatedDocumentProvider();
    const deps = { store, provider };
    const first = await issueOrderDocument(demoOrder(), readySettings(), deps);
    const second = await issueOrderDocument(demoOrder(), readySettings(), deps);
    assert.equal(second.id, first.id);
    assert.equal(provider.sendCalls, 1);
    assert.equal(store.rows.length, 1);
  });

  it("refuses to issue when the VAT rate is not configured", async () => {
    const store = new MemoryDocumentStore();
    const provider = new SimulatedDocumentProvider();
    await assert.rejects(
      () =>
        issueOrderDocument(demoOrder(), readySettings({ vatRatePercent: null }), {
          store,
          provider,
        }),
      DocumentConfigError,
    );
    assert.equal(store.rows.length, 0);
    assert.equal(provider.sendCalls, 0);
  });

  it("fails closed for a real document provider and stores nothing", async () => {
    await withFetchGuard(async () => {
      const provider = createDocumentProvider({ DOCUMENT_PROVIDER: "greeninvoice" });
      assert.ok(provider instanceof RefusedDocumentProvider);
      const store = new MemoryDocumentStore();
      await assert.rejects(
        () => issueOrderDocument(demoOrder(), readySettings(), { store, provider }),
        DocumentConfigError,
      );
      assert.equal(store.rows.length, 0);
      assert.equal((provider as RefusedDocumentProvider).sendCalls, 0);
    });
  });

  it("stores a credit for a demo document as simulated", async () => {
    const store = new MemoryDocumentStore();
    const provider = new SimulatedDocumentProvider();
    const original = await issueOrderDocument(demoOrder(), readySettings(), { store, provider });
    const credit = await creditDocument(original.id, { store, provider });
    assert.equal(credit.kind, "credit");
    assert.equal(credit.simulated, true);
    assert.equal(credit.demoOrder, true);
    assert.equal(credit.watermark, TEST_DOCUMENT_WATERMARK);
    assert.equal(credit.relatedDocumentId, original.id);
    const cancelled = await store.findById(original.id);
    assert.equal(cancelled?.status, "cancelled");
  });

  it("does not treat an unknown provider name as demo money", () => {
    assert.equal(isDemoMoney({ paymentProvider: "demo", paymentReference: "pay-1" }), true);
    assert.equal(isDemoMoney({ paymentProvider: "", paymentReference: null }), true);
    assert.equal(isDemoMoney({ paymentProvider: "tranzila", paymentReference: "demo-1" }), true);
    assert.equal(isDemoMoney({ paymentProvider: "tranzila", paymentReference: "pay-1" }), false);
  });
});

describe("notification sql", () => {
  it("keeps RLS on, adds no anon policy, and does not default a VAT rate", () => {
    const sql = readFileSync(new URL("../supabase/notifications-and-documents.sql", import.meta.url), "utf8");
    assert.match(sql, /enable row level security/i);
    assert.equal(/create policy/i.test(sql), false);
    assert.match(sql, /מסמך בדיקה – אינו מסמך חשבונאי/);
    assert.equal(/\b17\b/.test(sql), false);
    assert.equal(/vat_rate_percent[^;\n]*default/i.test(sql), false);
    assert.match(sql, /אישור השתתפות במתנה/);
    const invoiceSource = [
      "lib/invoices/settings.ts",
      "lib/invoices/render.ts",
      "lib/invoices/service.ts",
      "lib/invoices/providers.ts",
    ]
      .map((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8"))
      .join("\n");
    assert.equal(invoiceSource.includes("17"), false);
  });
});
